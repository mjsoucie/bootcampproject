// Environment variables
if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const url = process.env.DB_URL;
const secret = process.env.SECRET;
const port = process.env.PORT;

// Node
const path = require('path');

// Express (and related)
const express = require('express');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const ExpressError = require('./utils/ExpressError');
const methodOverride = require('method-override');

// Mongoose & Mongo (and related)
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const MongoDBStore = require("connect-mongo")(session);

// Flash
const flash = require('connect-flash');

// Passport
const passport = require('passport');
const LocalStrategy = require('passport-local');

// Helmet
const helmet = require('helmet');

// Models
const User = require('./models/user');

// Routes
const userRoutes = require('./routes/users');
const campgroundRoutes = require('./routes/campgrounds');
const reviewRoutes = require('./routes/reviews');

// Connect to database, establish session store and configure session
mongoose.connect(url, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const store = new MongoDBStore({
    url,
    secret,
    touchAfter: 24 * 60 * 60
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e)
})

const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

// Create an Express application instance named 'app'
const app = express();

// Register ejsMate as en ejs callback (template engine fucction that provides additional functionality to ejs).
// In the case of ejsMate, the 'layout' function is used.  When called anywhere inside a template, requests that 
// the output of the current template be passed to the given view as the body local. Use this to specify layouts 
// from within template since the app-level layout functionality has been removed from Express.
app.engine('ejs', ejsMate)

// Set 'ejs' as the view engine that will be used.  
// ejs will also serve as the template engine which enables the use of static template files. 
// At runtime, the template engine replaces variables in a template file with actual values, and transforms the template into an HTML file sent to the client.
app.set('view engine', 'ejs');

// Set the directory where the template files are located
app.set('views', path.join(__dirname, 'views'))

// Enable the parsing of incoming requests with urlencoded payloads
app.use(express.urlencoded({ extended: true }));

// Enable the override of "method"
app.use(methodOverride('_method'));

// Set the root location that Express will use to load static files (JS, CSS, etc.)
app.use(express.static(path.join(__dirname, 'public')))

// Enable mongoSanitize and set replecement character
app.use(mongoSanitize({
    replaceWith: '_'
}))

// Create a session middleware based on the configued options
// Used to create and manage session information
app.use(session(sessionConfig));

// Setup and enable Helmet security
app.use(helmet());
const scriptSrcUrls = [
    "https://stackpath.bootstrapcdn.com/",
    "https://api.tiles.mapbox.com/",
    "https://api.mapbox.com/",
    "https://kit.fontawesome.com/",
    "https://cdnjs.cloudflare.com/",
    "https://cdn.jsdelivr.net",
];
const styleSrcUrls = [
    "https://kit-free.fontawesome.com/",
    "https://stackpath.bootstrapcdn.com/",
    "https://api.mapbox.com/",
    "https://api.tiles.mapbox.com/",
    "https://fonts.googleapis.com/",
    "https://use.fontawesome.com/",
];
const connectSrcUrls = [
    "https://api.mapbox.com/",
    "https://a.tiles.mapbox.com/",
    "https://b.tiles.mapbox.com/",
    "https://events.mapbox.com/",
];
const fontSrcUrls = [];
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: [],
            connectSrc: ["'self'", ...connectSrcUrls],
            scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
            styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
            workerSrc: ["'self'", "blob:"],
            objectSrc: [],
            imgSrc: [
                "'self'",
                "blob:",
                "data:",
                "https://res.cloudinary.com/douqbebwk/", //SHOULD MATCH YOUR CLOUDINARY ACCOUNT! 
                "https://res.cloudinary.com/dmeivjakx/", // This allows for access to my images
                "https://images.unsplash.com/"
            ],
            fontSrc: ["'self'", ...fontSrcUrls],
        },
    })
);

// Setup and enable Passport (authentication)
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Enable flash messaging
app.use(flash());

// Set properties that are valid only for the lifetime of the request
// These variables (currentUser, success, error) are accessibe in templates rendered with res.render
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

// Assign routes based on request path
app.use('/', userRoutes);
app.use('/campgrounds', campgroundRoutes)
app.use('/campgrounds/:id/reviews', reviewRoutes)

// Render home page for get requests for '/'
app.get('/', (req, res) => {
    res.render('home')
});

// Display error is request is made for a non-supported route
app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404))
})

// Logic used if error is encountered
app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error', { err })
})

// Wait for activity request
app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})