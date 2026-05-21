import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { User } from '../models/User.js';

const router = express.Router();

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

const getJWTSecrets = () => {
  const secret = process.env.JWT_SECRET || 'marketpulse_jwt_secret_key_2026_super_secure';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'marketpulse_jwt_refresh_secret_key_2026_super_secure';
  return { secret, refreshSecret };
};

// Generate tokens helper
const generateTokens = (user) => {
  const { secret, refreshSecret } = getJWTSecrets();
  const payload = { id: user._id, email: user.email, name: user.name, role: user.role };
  
  const accessToken = jwt.sign(payload, secret, { expiresIn: ACCESS_EXPIRY });
  const refreshToken = jwt.sign({ id: user._id }, refreshSecret, { expiresIn: REFRESH_EXPIRY });
  
  return { accessToken, refreshToken };
};

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      passwordHash,
      portfolio: [],
      watchlist: [],
      preferences: { theme: 'dark', riskProfile: 'moderate' }
    });

    const { accessToken, refreshToken } = generateTokens(newUser);
    newUser.refreshTokens = [refreshToken];
    await newUser.save();

    return res.status(201).json({
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        preferences: newUser.preferences,
        portfolio: newUser.portfolio,
        watchlist: newUser.watchlist
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Persist refresh token, limit to last 5 tokens for multi-device login security
    user.refreshTokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    user.lastLogin = new Date();
    await user.save();

    return res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
        portfolio: user.portfolio,
        watchlist: user.watchlist
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const { refreshSecret, secret } = getJWTSecrets();

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err) {
      return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(403).json({ message: 'Refresh token not recognized' });
    }

    // Generate new access token
    const payload = { id: user._id, email: user.email, name: user.name, role: user.role };
    const newAccessToken = jwt.sign(payload, secret, { expiresIn: ACCESS_EXPIRY });

    return res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const { refreshSecret } = getJWTSecrets();
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err) {
      // Even if token expired, remove it if valid decoding is possible or search all
    }

    const userId = decoded ? decoded.id : null;
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
        await user.save();
      }
    }

    return res.json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot
router.post('/forgot', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't leak registered emails for security, return 200
      return res.json({ message: 'If the email exists, a password reset link has been generated' });
    }

    const { secret } = getJWTSecrets();
    const resetToken = jwt.sign({ id: user._id }, secret, { expiresIn: '1h' });

    // In local dev, create Ethereal Mail tester
    let testAccount = await nodemailer.createTestAccount();
    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, 
      auth: {
        user: testAccount.user, 
        pass: testAccount.pass, 
      },
    });

    const resetUrl = `http://localhost:3000/auth?resetToken=${resetToken}`;
    
    let info = await transporter.sendMail({
      from: '"MarketPulse Support" <no-reply@marketpulse.com>',
      to: user.email,
      subject: "Reset your MarketPulse Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; background-color: #050b14; color: #e8f4ff; border-radius: 10px;">
          <h2 style="color: #00d4ff; text-align: center;">MarketPulse Psychology</h2>
          <p>Hi ${user.name},</p>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #00d4ff, #00ff88); color: #050b14; padding: 12px 24px; text-decoration: none; border-radius: 25px; font-weight: bold; box-shadow: 0 0 15px rgba(0,212,255,0.4);">Reset Password</a>
          </div>
          <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">
          <p style="font-size: 12px; color: #6b8aaa;">Ethereal Dev Link: <a href="${nodemailer.getTestMessageUrl(info)}" target="_blank" style="color: #00ff88;">View Outgoing Email</a></p>
        </div>
      `
    });

    console.log(`[Dev Password Reset] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

    return res.json({
      message: 'If the email exists, a password reset link has been generated',
      previewUrl: nodemailer.getTestMessageUrl(info) // helpful for developer quick verification
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset/:token
router.post('/reset/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const { secret } = getJWTSecrets();
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(400).json({ message: 'Reset token is invalid or has expired' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.refreshTokens = []; // Revoke active sessions on password change
    await user.save();

    return res.json({ message: 'Password has been successfully updated. Please login.' });
  } catch (error) {
    next(error);
  }
});

export default router;
