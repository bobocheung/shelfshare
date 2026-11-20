/**
 * ShelfShare — campus textbook exchange
 * COMP 3810SEF group project
 *
 * Web pages (cookie-session login required):
 *   browse / search, create, update, delete textbook listings
 * REST API (no login):
 *   GET, POST, PUT, DELETE  /api/books
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const User = require('./models/User');
const Book = require('./models/Book');

const CONDITIONS = Book.CONDITIONS;
const STATUSES = Book.STATUSES;
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const SAMPLE_IDS = [
  '64f0a1000000000000000001',
  '64f0a1000000000000000002',
  '64f0a1000000000000000003',
  '64f0a1000000000000000004',
  '64f0a1000000000000000005',
  '64f0a1000000000000000006'
];

const app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('json spaces', 2);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieSession({
  name: 'shelfshare',
  keys: [process.env.SESSION_SECRET || 'shelfshare-comp3810sef-dev-key'],
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session && req.session.user ? req.session.user : null;
  res.locals.flash = req.session && req.session.flash ? req.session.flash : null;
  res.locals.conditions = CONDITIONS;
  res.locals.statuses = STATUSES;
  if (req.session) delete req.session.flash;
  next();
});

app.locals.money = (amount) => 'HK$' + Number(amount).toFixed(0);
app.locals.statusLabel = (status) => ({
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold'
}[status] || status);

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    req.session.flash = { type: 'error', message: 'Please log in before opening the textbook pages.' };
    return res.redirect('/login');
  }
  next();
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseObjectId(id) {
  if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) return null;
  const oid = new mongoose.Types.ObjectId(id);
  return oid.toString() === id ? oid : null;
}

function buildBookFilter(query) {
  const filter = {};
  if (query.title) filter.title = new RegExp(escapeRegex(query.title), 'i');
  if (query.author) filter.author = new RegExp(escapeRegex(query.author), 'i');
  if (query.courseCode) filter.courseCode = new RegExp(escapeRegex(query.courseCode), 'i');
  if (query.condition && CONDITIONS.includes(query.condition)) filter.condition = query.condition;
  if (query.status && STATUSES.includes(query.status)) filter.status = query.status;

  const price = {};
  if (query.minPrice !== undefined && query.minPrice !== '') {
    const min = Number(query.minPrice);
    if (Number.isFinite(min)) price.$gte = min;
  }
  if (query.maxPrice !== undefined && query.maxPrice !== '') {
    const max = Number(query.maxPrice);
    if (Number.isFinite(max)) price.$lte = max;
  }
  if (Object.keys(price).length > 0) filter.price = price;
  return filter;
}

function validateBook(input, requireAll) {
  const source = input || {};
  const errors = [];
  const book = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(source, key);

  if (requireAll || has('title')) {
    const title = String(source.title || '').trim();
    if (!title) errors.push('Title is required.');
    else if (title.length > 120) errors.push('Title must be 120 characters or fewer.');
    else book.title = title;
  }

  if (requireAll || has('author')) {
    const author = String(source.author || '').trim();
    if (!author) errors.push('Author is required.');
    else if (author.length > 80) errors.push('Author must be 80 characters or fewer.');
    else book.author = author;
  }

  if (requireAll || has('courseCode')) {
    const courseCode = String(source.courseCode || '').trim().toUpperCase();
    if (!courseCode) errors.push('Course code is required.');
    else if (!/^[A-Z0-9][A-Z0-9 -]{1,19}$/.test(courseCode)) errors.push('Course code looks invalid.');
    else book.courseCode = courseCode;
  }

  if (requireAll || has('edition')) {
    const edition = String(source.edition || '').trim();
    if (edition.length > 40) errors.push('Edition must be 40 characters or fewer.');
    else book.edition = edition;
  }

  if (requireAll || has('condition')) {
    const condition = source.condition || (requireAll ? 'Good' : '');
    if (!CONDITIONS.includes(condition)) errors.push('Condition must be New, Good, or Fair.');
    else book.condition = condition;
  }

  if (requireAll || has('price')) {
    const price = Number(source.price);
    if (!Number.isFinite(price) || price < 0 || price > 100000) errors.push('Price must be a number from 0 to 100000.');
    else book.price = Math.round(price * 100) / 100;
  }

  if (requireAll || has('status')) {
    const status = source.status || (requireAll ? 'available' : '');
    if (!STATUSES.includes(status)) errors.push('Status must be available, reserved, or sold.');
    else book.status = status;
  }

  if (requireAll || has('description')) {
    const description = String(source.description || '').trim();
    if (description.length > 1000) errors.push('Description must be 1000 characters or fewer.');
    else book.description = description;
  }

  if (requireAll || has('contact')) {
    const contact = String(source.contact || '').trim();
    if (contact.length < 4) errors.push('Contact must be at least 4 characters.');
    else if (contact.length > 80) errors.push('Contact must be 80 characters or fewer.');
    else book.contact = contact;
  }

  if (!requireAll && Object.keys(book).length === 0 && errors.length === 0) {
    errors.push('Provide at least one field to update.');
  }

  return { errors, book };
}

function formBook(body) {
  return {
    title: body.title || '',
    author: body.author || '',
    courseCode: body.courseCode || '',
    edition: body.edition || '',
    condition: body.condition || 'Good',
    price: body.price === undefined ? '' : body.price,
    status: body.status || 'available',
    description: body.description || '',
    contact: body.contact || ''
  };
}

function apiError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

app.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/books');
  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/books');
  res.render('login', {
    title: 'Log in',
    loggedOut: req.query.loggedout === '1',
    username: ''
  });
});

app.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ username });
    const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !matches) {
      res.locals.flash = { type: 'error', message: 'Invalid username or password.' };
      return res.status(401).render('login', {
        title: 'Log in',
        loggedOut: false,
        username
      });
    }
    req.session.user = {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName
    };
    setFlash(req, 'ok', 'Welcome back, ' + user.displayName + '.');
    res.redirect('/books');
  } catch (err) {
    next(err);
  }
});

app.get('/register', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/books');
  res.render('register', {
    title: 'Create account',
    errors: [],
    form: { username: '', displayName: '', email: '', programme: '' }
  });
});

app.post('/register', async (req, res, next) => {
  try {
    const form = {
      username: String(req.body.username || '').trim().toLowerCase(),
      displayName: String(req.body.displayName || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      programme: String(req.body.programme || '').trim()
    };
    const password = String(req.body.password || '');
    const errors = [];
    if (!/^[a-z0-9_]{3,20}$/.test(form.username)) errors.push('Username must be 3–20 letters, digits, or underscores.');
    if (form.displayName.length < 2 || form.displayName.length > 40) errors.push('Display name must be 2–40 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.push('Enter a valid email address.');
    if (password.length < 6) errors.push('Password must be at least 6 characters.');
    if (form.programme.length > 60) errors.push('Programme must be 60 characters or fewer.');

    if (errors.length === 0) {
      const taken = await User.findOne({ username: form.username });
      if (taken) errors.push('That username is already taken.');
    }
    if (errors.length > 0) {
      return res.status(400).render('register', { title: 'Create account', errors, form });
    }

    const user = await User.create({
      ...form,
      passwordHash: await bcrypt.hash(password, 10)
    });
    req.session.user = {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName
    };
    setFlash(req, 'ok', 'Account created. You can list a textbook now.');
    res.redirect('/books');
  } catch (err) {
    next(err);
  }
});

app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login?loggedout=1');
});

app.get('/books', requireLogin, async (req, res, next) => {
  try {
    const query = {
      title: String(req.query.title || '').trim(),
      author: String(req.query.author || '').trim(),
      courseCode: String(req.query.courseCode || '').trim(),
      condition: String(req.query.condition || ''),
      status: String(req.query.status || ''),
      maxPrice: String(req.query.maxPrice || '').trim()
    };
    const books = await Book.find(buildBookFilter(query)).sort({ updatedAt: -1 });
    res.render('list', { title: 'Textbooks', books, query });
  } catch (err) {
    next(err);
  }
});

app.get('/books/new', requireLogin, (req, res) => {
  const user = req.session.user;
  res.render('form', {
    title: 'New listing',
    mode: 'create',
    errors: [],
    book: {
      title: '',
      author: '',
      courseCode: '',
      edition: '',
      condition: 'Good',
      price: '',
      status: 'available',
      description: '',
      contact: user.username + '@hkmu.edu.hk'
    }
  });
});

app.post('/books', requireLogin, async (req, res, next) => {
  try {
    const { errors, book } = validateBook(req.body, true);
    if (errors.length > 0) {
      return res.status(400).render('form', {
        title: 'New listing',
        mode: 'create',
        errors,
        book: formBook(req.body)
      });
    }
    book.sellerName = req.session.user.displayName;
    book.sellerUsername = req.session.user.username;
    const created = await Book.create(book);
    setFlash(req, 'ok', 'Listing created.');
    res.redirect('/books/' + created._id);
  } catch (err) {
    next(err);
  }
});

app.get('/books/:id', requireLogin, async (req, res, next) => {
  try {
    const oid = parseObjectId(req.params.id);
    if (!oid) {
      setFlash(req, 'error', 'That listing id is not valid.');
      return res.redirect('/books');
    }
    const book = await Book.findById(oid);
    if (!book) return res.status(404).render('message', { title: 'Not found', message: 'This listing does not exist.' });
    res.render('details', { title: book.title, book });
  } catch (err) {
    next(err);
  }
});

app.get('/books/:id/edit', requireLogin, async (req, res, next) => {
  try {
    const oid = parseObjectId(req.params.id);
    if (!oid) {
      setFlash(req, 'error', 'That listing id is not valid.');
      return res.redirect('/books');
    }
    const book = await Book.findById(oid);
    if (!book) return res.status(404).render('message', { title: 'Not found', message: 'This listing does not exist.' });
    res.render('form', { title: 'Edit listing', mode: 'edit', errors: [], book });
  } catch (err) {
    next(err);
  }
});

app.post('/books/:id', requireLogin, async (req, res, next) => {
  try {
    const oid = parseObjectId(req.params.id);
    if (!oid) {
      setFlash(req, 'error', 'That listing id is not valid.');
      return res.redirect('/books');
    }
    const existing = await Book.findById(oid);
    if (!existing) return res.status(404).render('message', { title: 'Not found', message: 'This listing does not exist.' });

    const { errors, book } = validateBook(req.body, true);
    if (errors.length > 0) {
      return res.status(400).render('form', {
        title: 'Edit listing',
        mode: 'edit',
        errors,
        book: { ...formBook(req.body), _id: existing._id }
      });
    }
    await Book.updateOne({ _id: oid }, { $set: book });
    setFlash(req, 'ok', 'Listing updated.');
    res.redirect('/books/' + existing._id);
  } catch (err) {
    next(err);
  }
});

app.post('/books/:id/delete', requireLogin, async (req, res, next) => {
  try {
    const oid = parseObjectId(req.params.id);
    if (!oid) {
      setFlash(req, 'error', 'That listing id is not valid.');
      return res.redirect('/books');
    }
    const result = await Book.deleteOne({ _id: oid });
    setFlash(req, result.deletedCount ? 'ok' : 'error', result.deletedCount ? 'Listing deleted.' : 'Listing was already gone.');
    res.redirect('/books');
  } catch (err) {
    next(err);
  }
});

app.get('/api', (req, res) => {
  res.json({
    ok: true,
    name: 'ShelfShare REST API',
    authentication: 'not required',
    endpoints: [
      { method: 'GET', path: '/api/books', purpose: 'Read listings. Query: title, author, courseCode, condition, status, minPrice, maxPrice' },
      { method: 'GET', path: '/api/books/:id', purpose: 'Read one listing' },
      { method: 'POST', path: '/api/books', purpose: 'Create a listing (JSON body)' },
      { method: 'PUT', path: '/api/books/:id', purpose: 'Update a listing (JSON body)' },
      { method: 'DELETE', path: '/api/books/:id', purpose: 'Delete a listing' }
    ]
  });
});

app.get('/api/books', async (req, res, next) => {
  try {
    const books = await Book.find(buildBookFilter(req.query)).sort({ updatedAt: -1 });
    res.json({ ok: true, count: books.length, data: books });
  } catch (err) {
    next(err);
  }
});

app.get('/api/books/:id', async (req, res, next) => {
  try {
    const oid = parseObjectId(req.params.id);
    if (!oid) return apiError(res, 400, 'Invalid book id.');
    const book = await Book.findById(oid);
    if (!book) return apiError(res, 404, 'Book not found.');
    res.json({ ok: true, data: book });
  } catch (err) {
    next(err);
  }
});

app.post('/api/books', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return apiError(res, 400, 'JSON object body is required.');
    }
    const { errors, book } = validateBook(req.body, true);
    if (errors.length > 0) return res.status(400).json({ ok: false, message: 'Validation failed.', errors });

    const sellerName = String(req.body.sellerName || 'API user').trim();
    const sellerUsername = String(req.body.sellerUsername || 'api').trim().toLowerCase();
    if (!sellerName || sellerName.length > 80) return apiError(res, 400, 'sellerName must be 1–80 characters.');
    if (!/^[a-z0-9_]{1,20}$/.test(sellerUsername)) return apiError(res, 400, 'sellerUsername must be 1–20 letters, digits, or underscores.');
    book.sellerName = sellerName;
    book.sellerUsername = sellerUsername;

    const created = await Book.create(book);
    res.status(201).json({ ok: true, data: created });
  } catch (err) {
    next(err);
  }
});

app.put('/api/books/:id', async (req, res, next) => {
  try {
    const oid = parseObjectId(req.params.id);
    if (!oid) return apiError(res, 400, 'Invalid book id.');
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return apiError(res, 400, 'JSON object body is required.');
    }
    const existing = await Book.findById(oid);
    if (!existing) return apiError(res, 404, 'Book not found.');

    const touchesSeller = ['sellerName', 'sellerUsername'].some((key) => (
      Object.prototype.hasOwnProperty.call(req.body, key)
    ));
    let { errors, book } = validateBook(req.body, false);
    if (touchesSeller) {
      errors = errors.filter((item) => item !== 'Provide at least one field to update.');
    }
    if (errors.length > 0) return res.status(400).json({ ok: false, message: 'Validation failed.', errors });

    if (Object.prototype.hasOwnProperty.call(req.body, 'sellerName')) {
      const sellerName = String(req.body.sellerName || '').trim();
      if (!sellerName || sellerName.length > 80) return apiError(res, 400, 'sellerName must be 1–80 characters.');
      book.sellerName = sellerName;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'sellerUsername')) {
      const sellerUsername = String(req.body.sellerUsername || '').trim().toLowerCase();
      if (!/^[a-z0-9_]{1,20}$/.test(sellerUsername)) return apiError(res, 400, 'sellerUsername must be 1–20 letters, digits, or underscores.');
      book.sellerUsername = sellerUsername;
    }

    const updated = await Book.findByIdAndUpdate(oid, { $set: book }, { new: true, runValidators: true });
    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/books/:id', async (req, res, next) => {
  try {
    const oid = parseObjectId(req.params.id);
    if (!oid) return apiError(res, 400, 'Invalid book id.');
    const result = await Book.deleteOne({ _id: oid });
    if (!result.deletedCount) return apiError(res, 404, 'Book not found.');
    res.json({ ok: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

app.use('/api', (req, res) => apiError(res, 404, 'API route not found.'));

app.use((req, res) => {
  res.status(404).render('message', { title: 'Not found', message: 'This page does not exist.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return apiError(res, 400, 'Request body must be valid JSON.');
  }
  if (req.originalUrl.startsWith('/api')) {
    return apiError(res, 500, 'Server error.');
  }
  res.status(500).render('message', { title: 'Server error', message: 'Something went wrong. Please try again.' });
});

async function seedIfEmpty() {
  if (await User.countDocuments() === 0) {
    const accounts = [
      ['alice', 'alice123', 'Alice Chan', 'alice@hkmu.edu.hk', 'BSc Computing'],
      ['bob', 'bob123', 'Bob Lee', 'bob@hkmu.edu.hk', 'BBA'],
      ['admin', 'admin123', 'System Admin', 'admin@hkmu.edu.hk', 'Staff']
    ];
    const docs = [];
    for (const [username, password, displayName, email, programme] of accounts) {
      docs.push({
        username,
        passwordHash: await bcrypt.hash(password, 10),
        displayName,
        email,
        programme
      });
    }
    await User.insertMany(docs);
    console.log('Seeded users: alice / bob / admin');
  }

  if (await Book.countDocuments() === 0) {
    await Book.insertMany([
      {
        _id: SAMPLE_IDS[0],
        title: 'Software Engineering',
        author: 'Ian Sommerville',
        courseCode: 'COMP3810',
        edition: '10th',
        condition: 'Good',
        price: 180,
        status: 'available',
        description: 'Used for COMP3810SEF. Light highlighting in chapters 4 and 5.',
        contact: 'alice@hkmu.edu.hk',
        sellerName: 'Alice Chan',
        sellerUsername: 'alice'
      },
      {
        _id: SAMPLE_IDS[1],
        title: 'Database System Concepts',
        author: 'Abraham Silberschatz',
        courseCode: 'COMP3210',
        edition: '7th',
        condition: 'Fair',
        price: 140,
        status: 'available',
        description: 'Cover has a small crease. All chapters are included.',
        contact: 'alice@hkmu.edu.hk',
        sellerName: 'Alice Chan',
        sellerUsername: 'alice'
      },
      {
        _id: SAMPLE_IDS[2],
        title: 'Computer Networking: A Top-Down Approach',
        author: 'Kurose and Ross',
        courseCode: 'COMP3320',
        edition: '8th',
        condition: 'Good',
        price: 160,
        status: 'reserved',
        description: 'Reserved for a classmate. Contact Bob before paying.',
        contact: 'bob@hkmu.edu.hk',
        sellerName: 'Bob Lee',
        sellerUsername: 'bob'
      },
      {
        _id: SAMPLE_IDS[3],
        title: 'Clean Code',
        author: 'Robert C. Martin',
        courseCode: 'COMP3120',
        edition: '1st',
        condition: 'New',
        price: 220,
        status: 'available',
        description: 'Unread copy. Still in the original wrap.',
        contact: 'alice@hkmu.edu.hk',
        sellerName: 'Alice Chan',
        sellerUsername: 'alice'
      },
      {
        _id: SAMPLE_IDS[4],
        title: 'Introduction to Algorithms',
        author: 'Cormen, Leiserson, Rivest, Stein',
        courseCode: 'COMP3010',
        edition: '4th',
        condition: 'Good',
        price: 260,
        status: 'available',
        description: 'A few pencil notes in the margin of chapter 2.',
        contact: 'bob@hkmu.edu.hk',
        sellerName: 'Bob Lee',
        sellerUsername: 'bob'
      },
      {
        _id: SAMPLE_IDS[5],
        title: 'The Pragmatic Programmer',
        author: 'David Thomas and Andrew Hunt',
        courseCode: 'COMP3810',
        edition: '20th Anniversary',
        condition: 'Fair',
        price: 95,
        status: 'sold',
        description: 'Sold last week. Kept here as a record of the exchange.',
        contact: 'alice@hkmu.edu.hk',
        sellerName: 'Alice Chan',
        sellerUsername: 'alice'
      }
    ]);
    console.log('Seeded 6 textbook listings.');
  }
}

function redactUri(uri) {
  return String(uri).replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

async function connectDatabase() {
  const useMemory = process.argv.includes('--memory')
    || String(process.env.USE_MEMORY_DB).toLowerCase() === 'true';

  if (useMemory) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const memory = await MongoMemoryServer.create();
    await mongoose.connect(memory.getUri());
    console.log('Connected to an in-memory MongoDB. Listings reset when this process stops.');
    return;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shelfshare';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected to MongoDB:', redactUri(uri));
}

async function main() {
  try {
    await connectDatabase();
    await seedIfEmpty();
    app.listen(PORT, '0.0.0.0', () => {
      console.log('ShelfShare is running at http://localhost:' + PORT);
    });
  } catch (err) {
    console.error('Cannot start ShelfShare.');
    console.error(err.message);
    console.error('Start local MongoDB, set MONGODB_URI in a .env file, or run: npm run start:memory');
    process.exit(1);
  }
}

main();
