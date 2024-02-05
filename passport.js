// const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
require ('dotenv').config ();
// passport.use(
// 	new GoogleStrategy(
// 		{
// 			clientID: process.env.CLIENT_ID,
// 			clientSecret: process.env.CLIENT_SECRET,
// 			callbackURL: "/auth/google/callback",
// 			scope: ["profile", "email"],
// 		},
// 		function (accessToken, refreshToken, profile, callback) {
// 			callback(null, profile);
// 		}
// 	)
// );
passport.use(
	new GoogleStrategy(
	  {
		clientID: process.env.CLIENT_ID,
		clientSecret: process.env.CLIENT_SECRET,
		callbackURL: "/auth/google/callback",
		scope: ["profile", "email"],
	  },
	  function (accessToken, refreshToken, profile, done) {
		// Customize this part based on your needs
		return done(null, profile);
	  }
	)
  );

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});