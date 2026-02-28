require('dotenv').config();
const emailService = require('./src/services/emailService');

async function run() {
    console.log("Testing email...");
    const res = await emailService.sendEmail('test@example.com', 'Test', '<h1>Test</h1>');
    console.log("Result:", res);
}
run();
