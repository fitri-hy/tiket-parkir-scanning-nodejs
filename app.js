const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = 3000;
const ticketsFile = path.join(__dirname, 'data', 'tickets.json');
const settingsFile = path.join(__dirname, 'data', 'database.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

const readTickets = () => JSON.parse(fs.readFileSync(ticketsFile, 'utf8'));
const writeTickets = (tickets) => fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
const readSettings = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));

app.get('/', (req, res) => res.render('index'));

app.get('/admin', (req, res) => {
    const tickets = readTickets();
    tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.render('admin', { tickets });
});

app.post('/generate-ticket', async (req, res) => {
    const tickets = readTickets();
    const now = new Date();
    const id = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
    tickets.push({ id, createdAt: now.toISOString(), paid: false });
    writeTickets(tickets);

    try {
        const qrCode = await QRCode.toDataURL(id, { width: 500, margin: 1 });
        res.json({ id, qrCode });
    } catch (error) {
        console.error('Error generating QR Code:', error);
        res.status(500).json({ message: 'Failed to generate QR Code' });
    }
});

app.post('/check-ticket', (req, res) => {
    const { id } = req.body;
    const tickets = readTickets();
    const ticket = tickets.find(t => t.id === id);

    if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
    }

    const createdAt = new Date(ticket.createdAt);
    const now = new Date();
    const diffHours = Math.ceil((now - createdAt) / (1000 * 60 * 60));

	const settings = readSettings();
    let fee = settings.fee;
    if (diffHours > 1) {
        fee += (diffHours - 1) * settings.hourlyRate;
        if (fee > settings.maxFee) fee = settings.maxFee;
    }

    res.json({ fee, duration: diffHours, id: ticket.id, paid: ticket.paid });
});

app.post('/update-payment-status', (req, res) => {
    const { id, status } = req.body;
    const tickets = readTickets();
    const ticket = tickets.find(t => t.id === id);

    if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.paid = status === 'Paid';
    writeTickets(tickets);
    res.json({ message: 'Payment status updated', status: ticket.paid });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
