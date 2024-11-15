CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE customers ADD COLUMN role VARCHAR(20) DEFAULT 'user';
UPDATE customers SET role = 'admin' WHERE id = 11;
ALTER TABLE posts ADD COLUMN approved BOOLEAN DEFAULT false;

CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES customers(id),
  token VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_id INT REFERENCES customers(id),
    category_id INT REFERENCES categories(id) 
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    session_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

INSERT INTO customers (username, email, password) VALUES
('paola', 'paola@example.com', 'hashed_password');

-- Insert a category
INSERT INTO categories (name) VALUES ('Travel');
INSERT INTO categories (name) VALUES ('Technology');
INSERT INTO categories (name) VALUES ('Design');
INSERT INTO categories (name) VALUES ('Science');
INSERT INTO categories (name) VALUES ('Health');
INSERT INTO categories (name) VALUES ('Style');

-- Add Column

ALTER TABLE posts ADD COLUMN featured BOOLEAN DEFAULT FALSE;

ALTER TABLE customers
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN created_at SET DEFAULT NOW();