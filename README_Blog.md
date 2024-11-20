
# Blog website

This is a **Node.js** application built with **Express** that serves as a content management and blog system. The blog supports authentication through local credentials and **Google OAuth**, user session management, image uploading, and role-based access control (user, admin). This project includes an email notification system using **SendGrid** to send approval emails when a post is approved. The email content is generated with EJS templates, allowing for dynamic and personalized emails. Users can register, log in and log out, create posts on the topics of travel, science, health, technology, style and design. Once the post has been created, they will receive an email from the admin to be informed about the post's approval.Admins can log in and log out, approve users' posts, as well as edit and delete posts.

## Features
**User Authentication**: Login with local credentials or Google OAuth. Password hashing using bcrypt.

**Middleware isAuthenticated** to protect private pages. 
**Middleware isAdmin** to guarantee access to functions reserved for admins. Users and admin can register and access their profile securely (Passwords are hashed). They can also reset their password if they've forgotten it. 

**Reset Password** by email.

**Routes**: The code contains a series of paths to manage the blog's functionality, such as viewing, creating, editing, approving and deleting posts, as well as managing pagination and filtering by category or archive month.

**Role management**: Specific access for users with an admin role.

**Session management**: Sessions are managed with express-session.

**Uploading images**: Users can upload images for posts, managed with Multer.

**Sending emails**: Confirmation emails and notifications sent by Nodemailer and SendGrid.

**Search Icon Click Event**: Listens for clicks on the search icon and submits the search form automatically.

## Technologies
- Node.js and Express for server management.
- PostgreSQL for database management.
- EJS as template engine.
- dotenv: to manage environment variables securely.
- Passport.js for authentication, with Local and Google OAuth2 strategies.
- Multer for uploading images.
- Bcrypt for hashing passwords.
- Crypto: to generate password reset tokens.
- Nodemailer for sending emails.
- Connect-flash for handling flash messages.
- Body-Parser: for analysing data submitted via forms.
- Method-override to support PUT and DELETE HTTP in HTML forms.

## Javascript Functionality 
**Archives Toggle Button**: The button toggles the visibility of the archives list. By default, it limits the height to show fewer items, with a "Show more" button to expand the list. Users can collapse the list again by clicking "Show less."

**Flash messages**: Used for user feedback (success, error, etc.). Flash messages are set to automatically hide after 5 seconds.

**Back-to-Top Button**: A button that appears when the user scrolls close to the bottom of the page. Clicking it scrolls the page smoothly back to the top.

## Installation

**Clone the repository**: 

- git clone <repository-url>

- cd <repository-folder>

**Create an .env file in the root of the project and include the following environment variables:**:

- PG_USER=your_user
- PG_HOST=your_host
- PG_DATABASE=your_database
- PG_PASSWORD=your_password
- PG_PORT=5432
- SESSION_SECRET=your_secret
- GOOGLE_CLIENT_ID=your_google_client_id
- GOOGLE_CLIENT_SECRET=your_google_client_secret
- GMAIL_USER=<your_gmail>
- GMAIL_PASS=<your_password_gmail>

**Install Dependencies**:
- npm install

**Database Configuration**: 
- Start the PostgreSQL server and create the database and the necessary tables.

**Open your browser and navigate to http://localhost:3000 in order to view the app.**

## File Organization

**app.js**: Main file for starting the Express server. Contains several routes related to search filtering, viewing posts in archives, categories, and creating and deleting posts.

**views/**: Contains the EJS templates.

**public/**: Contains static files (CSS, images).

**partials/**: Contains header, footer and navbar file.ejs.

**middleware/**: Customised middleware.

**services/**: Services for external functions such as sending emails.

**routes/** Contains **authRoutes.js** file that provided defines routes related to authentication and user management.

**index.ejs**: It features a welcoming section, featured posts, a random post grid and a sidebar with an about section, archives, and social icons. Each post card includes:
Image, title, date, author, excerpt and a "Read More" button.

**login/register.ejs**: an authentication system to allow users to create an account , register and log out.

**forgot-password/reset-password.ejs**: The application offers a password recovery functionality, so that users can receive a link by email to reset their password in case they have forgotten it.

**createPost.ejs**: The application allows users to create new posts to add to the blog. The page contains a form that allows users to enter all the required details, including title, content, date, author, image and post category.

**editPost.ejs**: The application allows users to update existing posts. The **Edit Post** page includes a module that allows users to edit the title, content, image and author of a specific post.

**posts.ejs**: It displays full details of an individual post, including title, image, content, creation date and author. It also allows users to edit or delete the post.

**searchResults.ejs**: The **Search Results** page allows users to search through posts and view the results in a paginated navigation. This functionality is useful to allow users to quickly find specific content.

**categories.ejs**: The **Categories** page allows users to view posts within a specific category. Each post is represented in card format.

**queries.sql**: The queries.sql file contains SQL scripts designed for managing and interacting with the database of the project.

## Routes
**Main Routes**:
- **/login**: Displays the login page with flash messages for feedback.
- **/register**: Displays the registration page with flash messages.
- **/logout**: Logs the user out.
- **/auth/google**: Initiates authentication with Google.
- **/auth/google/callback**: Handles the callback from Google after the user authenticates. If successful, the user is redirected to the homepage; otherwise, they are redirected to the login page.
- **/forgot-password**: Handles the form submission to reset a user's password. It checks if the user exists in the database, generates a password reset token, stores it in the database, and sends a reset email with the reset link.
- **/reset-password/:token**: Displays the reset-password page, validating the token and ensuring it hasn't expired. If the token is valid, the reset form is displayed.
- **Local Strategy**: The LocalStrategy is used to authenticate users using their email and password. It compares the hashed password in the database with the provided password.
- **Google OAuth Strategy**: The GoogleStrategy is used to authenticate users via Google OAuth2. If the user does not exist in the database, a new user is created with the provided information.
**Home Route**
- **GET /**: Retrieves all approved posts from the database, orders them by creation date in descending order. Also fetches archives (by month) and categories, as well as 4 random posts to display in home page.
- **GET /create-post**: Form to create a new post. Only accessible to authenticated users.
- **POST /create-post**: Only accessible to authenticated user. Accepts a form submission to create a new post. Saves post data to the database with fields such as title, content, image, and category.
**Edit Post (Admin Only)**
- GET /post/:id/edit: Fetches post data for editing.

- POST /post/:id/update: Updates the post data in the database.
**Unapproved Posts (Admin Only)**
- GET /unapproved-posts: Lists all unapproved posts with pagination.
- POST /posts/:id/approve: Approves a specific post by id, sends an email notification to the post author, and marks the post as approved in the database.
- DELETE /posts/:id/delete: Deletes a specific post by id.
**Archives**
- GET /archives/:month: Retrieves all posts from a specific month.

## Database Structure
Set up with PostgreSQL. Linked using the pg library and is configured via environment variables.

## Newsletter Subscription
- The functionality for subscribing to a newsletter has not been implemented. Future updates may include this feature.



























## 🛠 Skills
Node.js, Express.js, EJS, Bootstrap for styling, dotenv (for environment variable management), Javascript functionality, dotenv, API SendGrid



## 🚀 About Me
I'm a junior developer!

