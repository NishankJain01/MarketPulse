import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Bearer token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'marketpulse_jwt_secret_key_2026_super_secure');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired access token', error: error.message });
  }
};
