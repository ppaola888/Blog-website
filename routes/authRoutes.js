import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { sendApprovalEmail } from '../views/services/emailService.js';
import { Strategy as LocalStrategy } from 'passport-local'; 
import { Strategy as GoogleStrategy } from 'passport-google-oauth2';
import { db } from '../app.js'; 
import flash from 'connect-flash';

const router = express.Router();

router.get("/login", (req, res) => {
    res.render("login.ejs", {
      user: req.user, 
      categories: req.categories,
      success: req.flash('success'),
      message: req.flash("message"),
      error: req.flash('error')
    });
  });
  
router.get("/register", (req, res) => {
    res.render("register.ejs", {
      user: req.user, 
      categories: req.categories,
      success: req.flash('success'),
      message: req.flash("message"),
      error: req.flash('error')
    });
  });
  
  router.get("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err); 
      }
      req.flash("success", "You have been logged out.");
      res.redirect("/"); 
    });
  });
  
router.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );
  
router.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/login",
    }),
    (req, res) => {
        res.redirect("/");
    }
);
  
passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true, 
  });
  
router.get("/forgot-password", (req, res) => {
    const message = req.session.message || null;
    req.session.message = null; 
    res.render("forgot-password", {message: message}); 
  });
  
  
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
      const result = await db.query("SELECT * FROM customers WHERE email = $1", [email]);
  
      if (result.rows.length === 0) {
        return res.render("forgot-password", { error: "Utente non trovato con questa email" });
      }
  
      const user = result.rows[0];
      const token = crypto.randomBytes(32).toString("hex");
      const expireAt = new Date(Date.now() + 86400000).toISOString(); // 1 day
  
      await db.query("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)", [user.id, token, expireAt]
      );
  
      const resetLink = `http://localhost:3000/reset-password/${token}`;
  
      await sendResetEmail(user.email, resetLink);
      res.render("forgot-password", { message: "Ti abbiamo inviato un'email per il reset della password." });
    } catch (error) {
      console.error(error);
      res.status(500).render("forgot-password", { error: "Errore nel reset della password. Riprova." });
    }
  });
  
  async function sendResetEmail(email, link) {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
  });
  
  const mailOptions = {
    from: "no-reply@tuosito.com",
    to: email,
    subject: "Reset della tua password",
    text: `Clicca su questo link per resettare la tua password: ${link}`,
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email inviata");
    } catch (error) {
      console.error("Errore nell'invio dell'email:", error);
    }
  }
  
router.get("/reset-password/:token", async (req, res) => {
    const { token } = req.params;
  
    const result = await db.query(
      "SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
  
    if (result.rows.length === 0) {
      return res.render("reset-password", { error: "Token invalido o scaduto" });
    }
  
    res.render("reset-password", { token, message: "Inserisci una nuova password." });
  });
  
  
router.post("/reset-password/:token", async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
  
    try {
      const result = await db.query(
        "SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()",
        [token]
      );
  
      if (result.rows.length === 0) {
        return res.render("reset-password", { error: "Token invalido o scaduto" });
      }
  
      const userId = result.rows[0].user_id;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
  
      await db.query("UPDATE customers SET password = $1 WHERE id = $2", [
        hashedPassword,
        userId,
      ]);
  
      await db.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
  
      res.render("login", { message: "Password reimpostata con successo. Ora puoi fare login." });
    } catch (error) {
      console.error(error);
      res.status(500).render("reset-password", { error: "Errore nel reset della password. Riprova." });
    }
  });
  
router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        req.flash('error', 'Si è verificato un errore. Riprova.');
        return res.redirect("/login");
      }
      if (!user) {
        req.flash('error', info.message || 'Email o password errati.');
        return res.redirect("/login");
      }
      req.logIn(user, (err) => {
        if (err) {
          req.flash('error', 'Errore durante il login. Riprova.');
          return res.redirect("/login");
        }
        req.flash('success', 'Login effettuato con successo!');
        return res.redirect("/");
      });
    })(req, res, next);
  });
  
  
router.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
  
    try {
      const checkResult = await db.query("SELECT * FROM customers WHERE email = $1", [
        email]);
  
      if (checkResult.rows.length > 0) {
        req.flash('error', 'Email già in uso. Prova con un\'altra email.');
        return res.redirect("/register");
      } else {
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
            req.flash('error', 'Errore durante la registrazione. Riprova.');
            return res.redirect("/register");
          } else {
            const result = await db.query(
              "INSERT INTO customers (username, email, password) VALUES ($1, $2, $3) RETURNING *",
              [username, email, hash]
            );
            req.flash('success', 'Registrazione avvenuta con successo! Puoi accedere.');
            return res.redirect("/login");
          }
        });
      }
    } catch (err) {
      console.error("Errore durante la registrazione:", err);
      req.flash('error', 'Errore durante la registrazione. Riprova.');
      return res.redirect("/register");
    }
  });
  
  passport.use(
    new LocalStrategy(async function verify(username, password, cb) {
      try {
        const result = await db.query("SELECT * FROM customers WHERE email = $1 ", [
          username]);
        if (result.rows.length === 0) {
          return cb(null, false, { message: "Utente non trovato con questa email." });
        }
        const user = result.rows[0];
        const storedHashedPassword = user.password;
  
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          }
  
          if (valid) {
            return cb(null, user);
          } else {
            return cb(null, false, { message: "Password non corretta." });
          }
        });
      } catch (err) {
        console.error(err);
        return cb(err);
      }
    })
  );
  
  passport.use(
    "google",
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          console.log(profile);
  
          const { email, displayName, given_name, family_name } = profile._json;
          let username = displayName || `${given_name}_${family_name}`;
  
          const result = await db.query("SELECT * FROM customers WHERE email = $1", [
            email]);
          if (result.rows.length === 0) {
            const newUser = await db.query(
              "INSERT INTO customers(email, username, password) VALUES ($1, $2, $3) RETURNING *",
              [email, username, "google"]
            );
            return cb(null, newUser.rows[0]);
          } else {
            return cb(null, result.rows[0]);
          }
        } catch (err) {
          return cb(err);
        }
      }
    )
  );
  
  passport.serializeUser((user, cb) => {
    cb(null, user.id);
  });
  passport.deserializeUser((id, cb) => {
    db.query('SELECT * FROM customers WHERE id = $1', [id], (err, result) => {
      if (err) return cb(err);
      cb(null, result.rows[0]);
    });
  });


export default router;