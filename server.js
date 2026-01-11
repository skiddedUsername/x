require('dotenv').config()

const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const webpush = require('web-push')
const app = express()
const http = require('http').Server(app)
const mongoose = require('mongoose')
const helmet = require("helmet")
const compression = require('compression')
const socketio = require("socket.io")
const crypto = require('crypto')

const updateEnv = require('./my_modules/updateenv')
const other = require('./my_modules/other')

/* =========================
   MongoDB Connection (Railway Safe)
========================= */

const mongoURL =
	process.env.MONGODB_URL ||
	process.env.MONGO_URL ||
	process.env.DATABASE_URL ||
	`mongodb://127.0.0.1:27017/${process.env.DATABASE_NAME || "db_brnx"}`

if (!mongoURL) {
	throw new Error("❌ MongoDB connection string not found")
}

mongoose.set('strictQuery', false)

mongoose.connect(mongoURL, {
	serverSelectionTimeoutMS: 5000,
})
.then(() => {
	console.log("✅ MongoDB database connected")
})
.catch(err => {
	console.error("❌ MongoDB connection failed:", err)
	process.exit(1)
})

/* =========================
   Models
========================= */

require('./models')
const ForumSettings = mongoose.model("ForumSettings")
const Accounts = mongoose.model("Accounts")

/* =========================
   Database Cleanup
========================= */

async function CleanMongoDatabase(){
	await mongoose.model("ActiveUsers").deleteMany({time: {$lt: Date.now() - 60000 * 15}})
	await mongoose.model("ForumAuditLogs").deleteMany({time: {$lt: Date.now() - 1000 * 60 * 60 * 24 * 30}})
	await mongoose.model("Messages").deleteMany({time: {$lt: Date.now() - 1000 * 60 * 60 * 24 * 90}})

	let expiredPremiumMembers = await Accounts.find({premium_expires: {$lt: new Date()}})
	for (let member of expiredPremiumMembers) {
		let roles = other.StringToArray(member.roles)

		let index = roles.indexOf("patron")
		if (index !== -1) roles.splice(index, 1)

		if (!roles.includes("vip")) roles.push("vip")

		member.roles = JSON.stringify(roles)
		await member.save()
	}
}

/* =========================
   Initial Setup Tasks
========================= */

mongoose.connection.once("open", async () => {

	let settings = await ForumSettings.find().lean()

	if (!settings.find(s => s.type === "description")) {
		await new ForumSettings({
			type: "description",
			value: "An online community powered by Powrum"
		}).save()
	}

	if (!process.env.PRIVATE_VAPID_KEY || !process.env.PUBLIC_VAPID_KEY) {
		const vapidKeys = webpush.generateVAPIDKeys()
if (!process.env.RAILWAY_ENVIRONMENT) {
	updateEnv({
		PRIVATE_VAPID_KEY: vapidKeys.privateKey,
		PUBLIC_VAPID_KEY: vapidKeys.publicKey,
	})
}


	webpush.setVapidDetails(
		`mailto:${process.env.SUPPORT_EMAIL_ADDRESS || "support@example.com"}`,
		process.env.PUBLIC_VAPID_KEY,
		process.env.PRIVATE_VAPID_KEY
	)

	if (!await Accounts.countDocuments()) {
		await new Accounts({ username: "BOT" }).save()
	}

	CleanMongoDatabase()
	setInterval(CleanMongoDatabase, 1000 * 60 * 60 * 24)
})

/* =========================
   Express Configuration
========================= */

app.use(helmet())
app.use(compression())
app.set('trust proxy', true)
app.set('view engine', 'ejs')

app.use((req, res, next) => {
	res.append('X-Forum-Software', 'Powrum')
	next()
})

app.use(express.static('public'))
app.use(express.static('public', { extensions: ['html'] }))

/* =========================
   Sessions (Railway Safe)
========================= */

if (!process.env.RAILWAY_ENVIRONMENT) {
	updateEnv({ SESSION_SECRET: crypto.randomBytes(64).toString('hex') })
}

const sessionMiddleware = session({
	secret: process.env.SESSION_SECRET,
	name: process.env.SESSION_COOKIE_NAME || '_PFSec',
	store: MongoStore.create({
		mongoUrl: mongoURL,
	}),
	saveUninitialized: false,
	rolling: true,
	resave: false,
	cookie: {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		maxAge: 1000 * 60 * 60 * 24 * 365,
		sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax'
	}
})

app.use(sessionMiddleware)

/* =========================
   Routes
========================= */

app.use('/api/', require('./routes/api/router'))

function isSetup(){
	return !!(
		process.env.FORUM_URL &&
		process.env.MAILGUN_DOMAIN &&
		process.env.MAILGUN_APIKEY
	)
}

let wwwRouter = require("./routes/install/index")
app.use("/", (req, res, next) => wwwRouter(req, res, next))

if (isSetup()) {
	wwwRouter = require('./routes/www/router')
}

app.use((req, res) => {
	res.status(404).render("404")
})

app.use((err, req, res, next) => {
	console.error("Express error:", err)
	res.status(500).render("500")
})

/* =========================
   Start Server
========================= */

const PORT = process.env.PORT || 8087
http.listen(PORT, () => {
	console.log(`🚀 Powrum server started on port ${PORT}`)
})

/* =========================
   Socket.IO
========================= */

const io = new socketio.Server(http, {
	cors: {
		origin: process.env.FORUM_URL || true,
		credentials: true
	}
})

io.engine.use(sessionMiddleware)
io.on('connection', require('./my_modules/websocket'))

module.exports.io = io
