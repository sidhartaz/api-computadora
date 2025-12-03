const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email ya registrado' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const validRoles = ['cliente', 'vendedor', 'admin'];
    const user = await User.create({
      name,
      email,
      password: hashed,
      role: validRoles.includes(role) ? role : 'cliente', // por defecto cliente
    });

    res.status(201).json({
      message: 'Usuario creado',
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Error en /register:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y password requeridos' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login correcto',
      token,
      role: user.role,
    });
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

module.exports = router;
