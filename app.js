import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import path from "path";
import session from "express-session";
import GoogleStrategy from "passport-google-oauth2";
import multer from "multer";
import methodOverride from "method-override";
import { format } from 'date-fns';
import crypto from "crypto";
import nodemailer from "nodemailer";
import flash from "connect-flash";
import { sendApprovalEmail } from './views/services/emailService.js';
import authRoutes from './routes/authRoutes.js';

env.config();

const app = express();
const port = 3000;
const saltRounds = 10;

const __dirname = path.resolve();

app.set('views', path.resolve(__dirname, 'views'));
app.set("view engine", "ejs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
})

const upload = multer({ storage: storage })

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true
    }
  })
);

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.message = req.flash('message');
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Database setup
const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

export { db };

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverride('_method'));

app.use(authRoutes);

app.use(async (req, res, next) => {
  res.locals.user = req.user || null;

  // Non caricare le categorie se siamo nella pagina di login o registrazione
  if (!req.path.startsWith('/login') && !req.path.startsWith('/register')) {
    if (!res.locals.categories) {
      try {
        const result = await db.query('SELECT * FROM categories');
        res.locals.categories = result.rows;
      } catch (error) {
        console.error("Error fetching categories:", error);
        res.locals.categories = []; 
      }
    }
  }
  next();
});

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  console.log('Checking if authenticated');
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('message', "Devi effettuare il login prima di accedere.");
    res.redirect('/login');
  }
}

// Middleware to check admin role
function isAdmin(req, res, next) {
  console.log('Checking if admin');
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  } else {
    res.status(403).send('Access denied. You are not authorized to perform this action');
    res.redirect('/');
  }
}

// Routes
app.get('/', async (req, res) => {
  try {
    const postResult = await db.query('SELECT posts.*, customers.username AS author FROM posts JOIN customers ON posts.customer_id = customers.id WHERE posts.approved = true ORDER BY posts.created_at DESC');
    const archivesResult = await db.query('SELECT TO_CHAR(created_at, \'YYYY-MM\') AS month, COUNT(*) AS count FROM posts GROUP BY TO_CHAR(created_at, \'YYYY-MM\') ORDER BY month DESC'); 
    const categoriesResult = await db.query('SELECT * FROM categories');
    const randomPostsResult = await db.query(
      'SELECT posts.*, customers.username AS author FROM posts JOIN customers ON posts.customer_id = customers.id ORDER BY RANDOM() LIMIT 4'
    );

    const posts = postResult.rows;
    const archives = archivesResult.rows;
    const categories = categoriesResult.rows;
    const randomPosts = randomPostsResult.rows;

    console.log('Archives:', archives);

    if (posts.length === 0) {
      console.log("No posts found in the database.");
    }

    res.render("index", { posts: posts, archives: archives, categories: categories, randomPosts: randomPosts  });
  } catch (error) {
    console.error('Error retrieving posts, archives, or categories:', error);
    req.flash('error', 'Error retrieving posts or archives.');
    res.redirect('/');
  }
});

app.get('/create-post', isAuthenticated, async (req, res) => {

  try {
    const result = await db.query('SELECT * FROM categories');
    const categories = result.rows;
    res.render('createPost.ejs', {
      categories: categories, message: req.flash('message'),
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (err) {
    console.error('Error retrieving categories:', error);
    req.flash('error', 'Error fetching categories.');
    res.redirect('/create-post');
  }
});

app.post("/create-post", isAuthenticated, upload.single("image"), async (req, res) => {
  console.log(req.body);  
  const { blog_title, content, day, category_id, featured } = req.body;
  const imagePath = req.file ? `/images/${req.file.filename}` : '/images/image.jpg';
  const isFeatured = featured ? true : false; 
  const categoryId = parseInt(category_id); 
  const customer_id = req.user.id; 
  const postDate = day ? new Date(day).toISOString() : new Date().toISOString();

  if (!req.user) {
    console.error("User not authenticated");
    req.flash('message', 'User not authenticated');
    return res.redirect("/login"); 
  }
  
  try {
    const result = await db.query(
        "INSERT INTO posts (title, content, customer_id, created_at, image_url, category_id, featured, approved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [blog_title, content, customer_id, postDate, imagePath, category_id, isFeatured, false]
    );
    const newPost = result.rows[0]; 
    req.flash('success', 'Post created successfully!');
    res.render('postConfirmation.ejs', { postId: newPost.id, success: req.flash('success') });
} catch (error) {
    console.error("Error creating post:", error);
    req.flash('error', 'Something went wrong. Please try again later.');
    res.redirect("/create-post");
}
});


app.get('/unapproved-posts', isAdmin, async (req, res) => {
  const postsPerPage = 10; 
  const currentPage = parseInt(req.query.page) || 1;

  try {
    const totalPostsResult = await db.query("SELECT COUNT(*) AS total FROM posts WHERE approved = false");
    const totalPosts = parseInt(totalPostsResult.rows[0].total);
    const totalPages = Math.ceil(totalPosts / postsPerPage); 

    const offset = (currentPage - 1) * postsPerPage;

    const result = await db.query("SELECT posts.*, customers.username AS author FROM posts JOIN customers ON posts.customer_id = customers.id WHERE posts.approved = false ORDER BY posts.created_at DESC");
    const unapprovedPosts = result.rows;
    res.render('unapprovedPosts.ejs', { unapprovedPosts,  totalPages, 
      currentPage  }); 
  } catch (error) {
    console.error("Error retrieving unapproved posts:", error);
    req.flash('error', 'Error retrieving unapproved posts.');
    res.status(500).render("Error retrieving unapproved posts");
  }
});

app.delete('/posts/:id/delete', isAuthenticated, isAdmin, async (req, res) => {
  const postId = parseInt(req.params.id, 10);

  try {
    await db.query('DELETE FROM posts WHERE id = $1', [postId]);
    req.flash('success', 'Post deleted successfully');
    res.redirect('/unapproved-posts');
  } catch (error) {
    console.error('Error deleting post:', error);
    req.flash('error', 'There was an error deleting the post.');
    res.redirect('/unapproved-posts');
  }
});

app.post('/posts/:id/approve', isAdmin, async (req, res) => {
  const postId = req.params.id;

  try {
    const result = await db.query('SELECT customers.email, posts.title FROM posts JOIN customers ON posts.customer_id = customers.id WHERE posts.id = $1', [postId]);
    if (result.rows.length === 0) {
      req.flash('message', 'Post non trovato');
      return res.redirect('/unapproved-posts');
    }

    const post = result.rows[0];
    const { email, title } = post;

    await db.query("UPDATE posts SET approved = true WHERE id = $1", [postId]);

    sendApprovalEmail(email, title, req.user.username);
    req.flash('success', 'Post approvato con successo!');
    res.redirect('/unapproved-posts');

  } catch (error) {
    console.error("Error approving post:", error);
    req.flash('error', 'Errore durante l\'approvazione del post');
    res.redirect('/unapproved-posts');
  }
});


app.get('/featured-posts', async (req, res) => {
  try {
      const result = await db.query("SELECT * FROM posts WHERE featured = true ORDER BY created_at DESC LIMIT 5");
      res.render('featured-posts', { posts: result.rows });
  } catch (err) {
      console.error(err);
      req.flash('error', 'Error retrieving featured posts');
  }
});

app.get('/archives/:month', async (req, res) => {
  const currentPage = parseInt(req.query.page) || 1; 
  const postsPerPage = 10;
  const offset = (currentPage - 1) * postsPerPage;

  try {
      const month  = req.params.month;
      const postResult = await db.query(
        `SELECT posts.*, customers.username AS author 
       FROM posts 
       JOIN customers ON posts.customer_id = customers.id 
       WHERE TO_CHAR(posts.created_at, 'YYYY-MM') = $1 
       ORDER BY posts.created_at DESC 
       LIMIT $2 OFFSET $3`,
        [month, postsPerPage, offset]
      );

       // Pagination for archives (months)
    const archivePage = parseInt(req.query.archivePage) || 1;
    const archivesPerPage = 10;
    const archiveOffset = (archivePage - 1) * archivesPerPage;
    const archivesResult = await db.query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count 
       FROM posts 
       GROUP BY TO_CHAR(created_at, 'YYYY-MM') 
       ORDER BY month DESC
       LIMIT $1 OFFSET $2`,
      [archivesPerPage, archiveOffset]
    );

      const totalPostsResult = await db.query(
        `SELECT COUNT(*) 
         FROM posts 
         WHERE TO_CHAR(posts.created_at, 'YYYY-MM') = $1`, 
        [month]
      );

      const totalPosts = parseInt(totalPostsResult.rows[0].count); 
      const totalPages = Math.ceil(totalPosts / postsPerPage);

      const totalArchivesResult = await db.query(
        `SELECT COUNT(DISTINCT TO_CHAR(created_at, 'YYYY-MM')) AS count 
         FROM posts`
      );

      const totalArchives = parseInt(totalArchivesResult.rows[0].count);
      const totalArchivePages = Math.ceil(totalArchives / archivesPerPage);
  
      const posts = postResult.rows;
      const archives = archivesResult.rows;
  
      if (posts.length === 0) {
        console.log("No posts found for the archive.");
      }
  
      res.render("archives.ejs", { posts: posts,
        archives: archives,
        currentPage: currentPage,
        totalPages: totalPages,
        month: month,
        archivePage: archivePage,
        totalArchivePages: totalArchivePages
      });
    } catch (error) {
      console.error('Error retrieving archive posts:', error);
      req.flash('error', 'Error retrieving archive posts:');
      res.redirect('/');
    }
  });

app.get('/category/:id', async (req, res) => {

  try {
    const categoryId  = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const offset = (page - 1) * limit;

    const postResult = await db.query(`
      SELECT posts.*, customers.username AS author
      FROM posts
      JOIN customers ON posts.customer_id = customers.id
      WHERE category_id = $1 AND posts.approved = true 
      ORDER BY posts.created_at DESC
      LIMIT $2 OFFSET $3`, [categoryId, limit, offset]);

      const categoryNameResult = await db.query('SELECT name FROM categories WHERE id = $1', [categoryId]);

      const categoryResult = await db.query('SELECT * FROM categories');

      const randomPostsResult = await db.query(
        'SELECT posts.*, customers.username AS author FROM posts JOIN customers ON posts.customer_id = customers.id ORDER BY RANDOM() LIMIT 3'
      );

      const countResult = await db.query(`
        SELECT COUNT(*) AS count
        FROM posts
        WHERE category_id = $1 AND approved = true`, [categoryId]);

      const totalPosts = countResult.rows[0].count;
      const totalPages = Math.ceil(totalPosts / limit); 

      const archivesResult = await db.query(
        'SELECT TO_CHAR(created_at, \'YYYY-MM\') AS month, COUNT(*) AS count FROM posts WHERE approved = true GROUP BY TO_CHAR(created_at, \'YYYY-MM\') ORDER BY month DESC'
        );
      const archives = archivesResult.rows;

      const posts = postResult.rows;
      const categories = categoryResult.rows;
      const randomPosts = randomPostsResult.rows;
      const categoryName = categoryNameResult.rows[0]?.name; 

      if (!categoryName) {
        console.log("Category not found.");
        return res.redirect('/');
      }
  
      if (posts.length === 0) {
        console.log("No posts found for this category.");
      }

      res.render('categories.ejs', {
        posts: posts,
        categories: categories,
        categoryName: categoryName,
        randomPosts: randomPosts,
        totalPages: totalPages, 
        currentPage: page,
        categoryId: categoryId, 
        archives: archives 
       });
    } catch (error) {
      console.error('Error retrieving posts by category:', error);
      res.redirect('/');
    }
 });

app.get('/latest-posts', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT posts.*, customers.username AS author FROM posts JOIN customers ON posts.customer_id = customers.id ORDER BY posts.created_at DESC LIMIT 5'
    );
    
    const posts = result.rows;
    res.render('latestPosts.ejs', { posts: posts });
  } catch (error) {
    console.error('Errore nel recupero dei post più recenti:', error);
    req.flash('error', 'Error retrieving most recent posts:');
    res.redirect('/');
  }
});

app.get("/post/:id/edit", isAuthenticated, isAdmin, async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const result = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
  if (result.rows.length > 0) {
    const post = result.rows[0];

    req.flash('success', 'Successfully fetched the post for editing!');
    res.render('editPost.ejs', { post, 
      message: req.flash('message'),
      success: req.flash('success'),
      error: req.flash('error')
     });
  } else {
    req.flash('error', 'Post not found');
    return res.redirect('/');
  }
});

app.post("/post/:id/update", upload.single("image"), async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const updatedTitle = req.body.title;
  const updatedContent = req.body.content;
  const updateAuthor = req.body.authorname;
  const updatedImage = req.file ? `/images/${req.file.filename}` : undefined;

  const updateAuthorId = req.user ? req.user.id : null; 

  try {
    const result = await db.query(`UPDATE posts SET title = $1, content = $2, customer_id = $3, image_url = COALESCE($4, image_url) WHERE id = $5 RETURNING *`,
      [updatedTitle, updatedContent, updateAuthorId, updatedImage, postId]
    );

  if (result.rows.length > 0) {
      req.flash('success', 'Post updated successfully!');
      res.redirect(`/posts/${postId}`);
  } else {
      req.flash('error', 'Post not found');
      res.redirect(`/posts/${postId}/edit`);
  }
} catch (error) {
  console.error("Error updating the post:", error);
  req.flash('error', 'Error updating the post');
  res.redirect(`/posts/${postId}/edit`);
}
});

app.delete('/posts/:id/delete', isAuthenticated, isAdmin, async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  console.log(`DELETE request received for post ID: ${postId}`);

  try {
    await db.query('DELETE FROM posts WHERE id = $1', [postId]);
  
    req.flash('success', 'Post deleted successfully');
    res.redirect('/'); 

  } catch (error) {
    console.error('Error deleting post:', error);
    req.flash('error', 'There was an error deleting the post.');
    res.redirect('/'); 
  }
});

app.post('/posts', isAuthenticated, async (req, res) => {
  const { title, content, category_id, image_url } = req.body;
  const customer_id = req.session.customer_id;

  try {
    const result = await db.query('INSERT INTO posts (title, content, image_url, customer_id, category_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, content, image_url, customer_id, category_id]
    );
    const newPost = result.rows[0];

    res.redirect(`/posts/${newPost.id}`);
  } catch (error) {
    console.error('Errore nella creazione del post:', error);
    req.flash('error', 'Error in creating post');
    }
});

app.get("/posts/:id", async (req, res) => {
  const postId = req.params.id; 

  try {
    const postResult = await db.query(
      `SELECT posts.*, customers.username AS author, TO_CHAR(posts.created_at, 'YYYY-MM-DD') AS date
       FROM posts
       JOIN customers ON posts.customer_id = customers.id
       WHERE posts.id = $1`, [postId]
    );
    const post = postResult.rows[0];

    const categoriesResult = await db.query('SELECT * FROM categories');
    
    const categories = categoriesResult.rows;

    if (!post) {
      console.log("Post not found.");
      return res.redirect('/');
    }

    res.render("post.ejs", { post: post, categories: categories });
  } catch (error) {
    console.error('Error fetching the post:', error);
    req.flash('error', 'Error fetching the post');
    res.redirect('/');
  }
});


function isCustomer(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'user') {
    return next();
  } else {
    req.flash('error', 'You must be logged in as a customer to search.');
    res.redirect('/login');
  }
}

app.get('/search', isCustomer, async (req, res) => {
  try {

    if (req.user && req.user.role === 'admin') {
      req.flash('error', 'Admins are not allowed to perform a search.');
      return res.redirect('/');
    }

    const query = req.query.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const offset = (page - 1) * limit;

    if (!query) {
      console.log("Search query is missing.");
      req.flash('error', 'Search query is missing.');
      return res.redirect('/');
    }

    const titleSearchResult = await db.query(`
      SELECT posts.*, customers.username AS author, categories.name
      FROM posts
      JOIN customers ON posts.customer_id = customers.id
      LEFT JOIN categories ON posts.category_id = categories.id
      WHERE LOWER(posts.title) LIKE LOWER($1) OR LOWER(categories.name) LIKE LOWER($1)  OR LOWER(posts.content) LIKE LOWER($1) 
      AND posts.approved = true
      ORDER BY posts.created_at DESC
      LIMIT $2 OFFSET $3
    `, [`%${query}%`, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) AS count
      FROM posts
      LEFT JOIN categories ON posts.category_id = categories.id
      WHERE LOWER(title) LIKE LOWER($1) OR LOWER(categories.name) LIKE LOWER($1)  OR LOWER(posts.content) LIKE LOWER($1) 
      AND approved = true
    `, [`%${query}%`]);

    const totalPosts = countResult.rows[0].count;
    const totalPages = Math.ceil(totalPosts / limit);

    const categoryResult = await db.query('SELECT * FROM categories');
    const randomPostsResult = await db.query(`
      SELECT posts.*, customers.username AS author
      FROM posts
      JOIN customers ON posts.customer_id = customers.id
      ORDER BY RANDOM() LIMIT 5
    `);
    const archivesResult = await db.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
      FROM posts
      WHERE approved = true
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `);

    const posts = titleSearchResult.rows;
    const categories = categoryResult.rows;
    const randomPosts = randomPostsResult.rows;
    const archives = archivesResult.rows;

    res.render('searchResults.ejs', {
      posts: posts,
      categories: categories,
      randomPosts: randomPosts,
      totalPages: totalPages,
      currentPage: page,
      searchQuery: query,
      archives: archives
    });
  } catch (error) {
    console.error('Error retrieving search results:', error);
    req.flash('error', "Error retrieving search results.");
    res.redirect('/');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});