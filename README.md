# ShelfShare — Campus Textbook Exchange

COMP 3810SEF Autumn 2026 group project.  
ShelfShare is a server-side web application for students to pass on second-hand course books. A logged-in student can search listings and create, update, or delete them. The same records are also exposed as RESTful CRUD APIs, which do not require a login.

## 1. Project info

- Project name: **ShelfShare**
- Purpose: a campus noticeboard for second-hand textbooks. Each listing stores the title, author, course code, edition, condition, price (HKD), sale status, seller, contact, and a short note.
- Stack: Express.js, EJS, Mongoose (MongoDB), cookie-session.

Before submission, rename this folder and the zip file to your real group number, for example `comp3810sef_group1`.

## 2. Group info

- Group no.: **【請填寫，例如 group1】**

| Name | Student ID | Work role |
| --- | --- | --- |
| 【請填寫】 | 【請填寫】 | Server routes and cookie-session login / logout |
| 【請填寫】 | 【請填寫】 | MongoDB schemas, connection, and seed data |
| 【請填寫】 | 【請填寫】 | CRUD web pages (create, search, update, delete) |
| 【請填寫】 | 【請填寫】 | RESTful API and cURL tests |
| 【請填寫】 | 【請填寫】 | UI pages and stylesheet |
| 【請填寫】 | 【請填寫】 | README, demo script, and deployment |

Delete unused rows if the group has 4 or 5 members. Every member needs a real role. Replace the placeholders before submission.

## 3. Project file intro

### server.js

The entry file. It:

- connects to MongoDB with Mongoose, then seeds sample users and six textbooks when the collections are empty
- serves the login, register, and logout pages
- blocks `/books` pages unless the browser has a cookie-session
- renders the textbook CRUD pages
- serves `/api/books` for GET, POST, PUT, and DELETE without authentication

### package.json

Runtime dependencies:

| Package | Use |
| --- | --- |
| express | Web framework and routing |
| ejs | HTML templates |
| mongoose | MongoDB object models |
| cookie-session | Login session stored in a signed cookie |
| bcryptjs | Password hashing |
| dotenv | Optional `.env` settings |
| mongodb-memory-server | Fallback only when MongoDB is not installed (`npm run start:memory`) |

Scripts:

- `npm start` — connect to `MONGODB_URI` or `mongodb://127.0.0.1:27017/shelfshare`
- `npm run start:memory` — start a temporary MongoDB in this process. Data is discarded when the server stops. Use this for a quick local demo if MongoDB is not installed.

### public

| File | What it is |
| --- | --- |
| `public/css/style.css` | Layout and visual style for every page |
| `public/favicon.svg` | Browser tab icon |

### views

EJS templates:

| File | Page |
| --- | --- |
| `views/partials/header.ejs` | Shared head, navigation, and logout button |
| `views/partials/footer.ejs` | Shared footer |
| `views/login.ejs` | Login form and sample accounts |
| `views/register.ejs` | Create-account form |
| `views/list.ejs` | Search form and listing cards (read / update / delete buttons) |
| `views/form.ejs` | Create form and edit form |
| `views/details.ejs` | One listing, with Edit and Delete |
| `views/message.ejs` | Not-found and error page |

### models

| File | Collection | Contents |
| --- | --- | --- |
| `models/User.js` | `users` | username, password hash, display name, email, programme |
| `models/Book.js` | `books` | textbook listing fields, condition, status, seller |

### Other files

| File | Contents |
| --- | --- |
| `.env.example` | Sample `PORT`, `MONGODB_URI`, `SESSION_SECRET` |
| `.gitignore` | Ignores `node_modules/` and `.env` |

Do not submit the `node_modules` folder. The zip name must be `comp3810sef_groupNo.zip`.

## 4. Operation guides

### 4.1 Install and start

Requirements: Node.js 18 or newer, and MongoDB Community Server (or MongoDB Atlas).

```bash
cd comp3810sef_groupNo
npm install
```

Local MongoDB (default database name `shelfshare`):

```bash
npm start
```

Atlas or another host: copy `.env.example` to `.env` and set `MONGODB_URI`.

No MongoDB installed:

```bash
npm run start:memory
```

Open `http://localhost:3000`. The server listens on `PORT` (default `3000`).

The first launch inserts three users and six books. Later launches keep the existing data. To load the samples again, drop the database (for example `shelfshare`) and start the server once more.

### 4.2 Login / logout

Sample passwords (created automatically when the user collection is empty):

| Username | Password | Display name |
| --- | --- | --- |
| alice | alice123 | Alice Chan |
| bob | bob123 | Bob Lee |
| admin | admin123 | System Admin |

Sign-in steps:

1. Open `http://localhost:3000`. The server redirects to `/login`.
2. Enter a username and password from the table, then press **Log in**.
3. The server stores the user in a cookie-session and opens `/books`.
4. Visiting `/books` while logged out redirects back to `/login`.
5. Press **Log out** on the textbook pages. The session cookie is cleared and the login page shows “You have logged out.”

A new student can open **Create an account**, then the server logs that student in. Usernames are 3–20 letters, digits, or underscores. Passwords are at least 6 characters and are stored with bcrypt.

### 4.3 CRUD web pages

All of these pages require a login. Each one shows a **Log out** button in the top bar.

| Action | Where | Control |
| --- | --- | --- |
| Create | `/books/new` | Button **New listing**, then **Create listing** |
| Read | `/books` | Form fields Title, Author, Course code, Condition, Status, Max price, then **Search**. **Clear** resets the query. **View** opens one listing. |
| Update | `/books/:id/edit` | Button **Edit**, then **Save changes** |
| Delete | listing card or detail page | Button **Delete**, then confirm |

Try this flow:

1. Log in as `alice`.
2. Search course code `COMP3810`. Two sample books match.
3. Search status `available` and max price `150`.
4. Press **New listing**, enter a book, and press **Create listing**.
5. Open that listing, press **Edit**, change the price or status, and press **Save changes**.
6. Press **Delete** and confirm. The list no longer shows that book.

Condition is `New`, `Good`, or `Fair`. Status is `available`, `reserved`, or `sold`.

### 4.4 RESTful CRUD services

No login and no cookie are required. Responses are JSON.

Base URL: `http://localhost:3000`

| Action | HTTP | URI | Notes |
| --- | --- | --- | --- |
| Service list | GET | `/api` | Short description of the API |
| Read many | GET | `/api/books` | Optional query: `title`, `author`, `courseCode`, `condition`, `status`, `minPrice`, `maxPrice` |
| Read one | GET | `/api/books/:id` | |
| Create | POST | `/api/books` | JSON body |
| Update | PUT | `/api/books/:id` | JSON body, send only the fields to change |
| Delete | DELETE | `/api/books/:id` | |

Sample listing ids (stable until that document is deleted):

| id | Book |
| --- | --- |
| `64f0a1000000000000000001` | Software Engineering (COMP3810, available) |
| `64f0a1000000000000000002` | Database System Concepts (COMP3210) |
| `64f0a1000000000000000003` | Computer Networking (COMP3320, reserved) |
| `64f0a1000000000000000004` | Clean Code (COMP3120, New) |
| `64f0a1000000000000000005` | Introduction to Algorithms (COMP3010) |
| `64f0a1000000000000000006` | The Pragmatic Programmer (COMP3810, sold) |

Create body fields: `title`, `author`, `courseCode`, `price`, `contact` are required. Optional: `edition`, `condition`, `status`, `description`, `sellerName`, `sellerUsername`.

#### cURL (Ubuntu / bash)

Prepare these before the demo. Run them in this order so the sample used by PUT is still there.

Read the endpoint list:

```bash
curl http://localhost:3000/api
```

Read all listings:

```bash
curl "http://localhost:3000/api/books"
```

Read one listing:

```bash
curl http://localhost:3000/api/books/64f0a1000000000000000001
```

Read with several query conditions (course, status, and maximum price):

```bash
curl "http://localhost:3000/api/books?courseCode=COMP3810&status=available&maxPrice=200"
```

Create:

```bash
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Node.js Design Patterns\",\"author\":\"Mario Casciaro\",\"courseCode\":\"COMP3810\",\"edition\":\"3rd\",\"condition\":\"Good\",\"price\":130,\"status\":\"available\",\"contact\":\"demo@hkmu.edu.hk\",\"description\":\"Extra copy for the group demo.\",\"sellerName\":\"Demo Student\",\"sellerUsername\":\"demo\"}"
```

Update the reserved networking book to available and change the price:

```bash
curl -X PUT http://localhost:3000/api/books/64f0a1000000000000000003 \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"available\",\"price\":150}"
```

Delete the sold sample. Skip this during rehearsal if you still want that row on the web page. Drop the database and restart to restore every sample.

```bash
curl -X DELETE http://localhost:3000/api/books/64f0a1000000000000000006
```

#### cURL on Windows PowerShell

PowerShell’s `curl` is an alias. Call `curl.exe`.

```powershell
curl.exe http://localhost:3000/api/books
curl.exe "http://localhost:3000/api/books?courseCode=COMP3810&status=available&maxPrice=200"
curl.exe http://localhost:3000/api/books/64f0a1000000000000000001
curl.exe -X POST http://localhost:3000/api/books -H "Content-Type: application/json" -d "{\"title\":\"Node.js Design Patterns\",\"author\":\"Mario Casciaro\",\"courseCode\":\"COMP3810\",\"edition\":\"3rd\",\"condition\":\"Good\",\"price\":130,\"status\":\"available\",\"contact\":\"demo@hkmu.edu.hk\",\"description\":\"Extra copy for the group demo.\",\"sellerName\":\"Demo Student\",\"sellerUsername\":\"demo\"}"
curl.exe -X PUT http://localhost:3000/api/books/64f0a1000000000000000003 -H "Content-Type: application/json" -d "{\"status\":\"available\",\"price\":150}"
curl.exe -X DELETE http://localhost:3000/api/books/64f0a1000000000000000006
```

A missing id returns HTTP 404 and `{ "ok": false, "message": "Book not found." }`. A bad id returns HTTP 400.

### 4.5 Ten-minute demo order

1. Project name, group number, names, student IDs, and each member’s role.
2. Start the server (`npm start` or the deployed URL) and show the terminal.
3. Log in as `alice` / `alice123`.
4. Search, create, edit, and delete one listing. Point at **Log out**, then log in again.
5. Run the prepared cURL commands for GET, POST, PUT, and DELETE.

### 4.6 Cloud deploy on Render

The app listens on `process.env.PORT` and, when `NODE_ENV` is `production`, trusts Render’s HTTPS proxy so the login cookie is marked secure. Do not set `USE_MEMORY_DB` on Render. Data must live in MongoDB Atlas (or another reachable MongoDB). `mongodb-memory-server` is a devDependency, so a production install does not download a local MongoDB binary.

1. Create a free MongoDB Atlas cluster. Database name: `shelfshare`. In Network Access, allow `0.0.0.0/0` (Render does not use a fixed IP). Copy the connection string, for example `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/shelfshare`.
2. Create a public GitHub repository and push this folder. Do not commit `node_modules/` or `.env`.
3. On [render.com](https://render.com), sign in with GitHub, then **New → Web Service** and pick that repository. Root directory stays blank if `package.json` is at the repository root. Render reads `render.yaml` when you use a Blueprint; a manual Web Service uses the same values:
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: **Free**
4. Environment variables:

| Key | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection string |
| `SESSION_SECRET` | a long random string |
| `NODE_ENV` | `production` (Render sets this for Node web services) |

Do not set `USE_MEMORY_DB`. Leave `PORT` unset; Render supplies it.

5. Deploy and wait until the service is **Live**. Open `https://<your-service>.onrender.com`. The first request after idle time can take about a minute while the free instance wakes up. The first successful start seeds `alice` / `alice123`, `bob` / `bob123`, and `admin` / `admin123`.
