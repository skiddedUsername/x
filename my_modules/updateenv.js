const fs = require('fs')
const path = require('path')

module.exports = function updateEnv(newValues) {

	// 🚫 Do not write .env on Railway / production PaaS
	if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === "production") {
		console.log("ℹ️ Skipping .env update (Railway environment detected)")
		return
	}

	const envPath = path.resolve(process.cwd(), '.env')

	let env = ''
	if (fs.existsSync(envPath)) {
		env = fs.readFileSync(envPath, 'utf8')
	}

	for (const [key, value] of Object.entries(newValues)) {
		const regex = new RegExp(`^${key}=.*$`, 'm')
		if (regex.test(env)) {
			env = env.replace(regex, `${key}=${value}`)
		} else {
			env += `\n${key}=${value}`
		}
	}

	fs.writeFileSync(envPath, env.trim() + '\n')
}
