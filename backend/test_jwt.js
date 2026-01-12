const jwt = require('jsonwebtoken');

const secret = 'supersecretkey';
const payload = { userId: 1, role: 'USER' };

// Sign token without expiresIn
const token = jwt.sign(payload, secret);
console.log('Token:', token);

// Verify immediately
jwt.verify(token, secret, (err, decoded) => {
    if (err) {
        console.error('Immediate verification failed:', err);
    } else {
        console.log('Immediate verification success:', decoded);
    }
});

// Verify after 2 seconds (simulating delay)
setTimeout(() => {
    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            console.error('Delayed verification failed:', err);
        } else {
            console.log('Delayed verification success:', decoded);
        }
    });
}, 2000);
