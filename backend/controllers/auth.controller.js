const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id },
    'SECRET_KEY', 
    { expiresIn: '30d' }
  );
};

// -------------------------
// 1. REGISTER & SEND OTP
// -------------------------
exports.register = async (req, res) => {
  try {
    // 🔥 Extract the new E2EE Vault keys and public keys
    const { username, email, password, avatar, publicKey, signPublicKey, primaryVault, recoveryVault } = req.body;

    if (!email || !username) return res.status(400).json({ error: 'Username and Email required' });
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    let existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });

    const hashed = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 15 * 60 * 1000;

    let user;

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ error: 'User with this email or username already exists' });
      } else {
        existingUser.password = hashed;
        existingUser.otp = otp;
        existingUser.otpExpires = otpExpires;
        if (avatar) existingUser.avatar = avatar; 
        
        // Save the new vault architecture for ghost users
        if (publicKey) existingUser.publicKey = publicKey;
        if (signPublicKey) existingUser.signPublicKey = signPublicKey;
        if (primaryVault) existingUser.primaryVault = primaryVault;
        if (recoveryVault) existingUser.recoveryVault = recoveryVault;
        
        user = await existingUser.save();
      }
    } else {
      user = await User.create({
        username: cleanUsername,
        email: cleanEmail,
        password: hashed,
        avatar: avatar || null,
        isVerified: false,
        otp: otp,
        otpExpires: otpExpires,
        publicKey: publicKey || null,
        signPublicKey: signPublicKey || null,
        primaryVault: primaryVault || null,
        recoveryVault: recoveryVault || null
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'Gmail', 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS  
      }
    });

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Arisun Chat — Verify Your Account',
      text: `Thank you for registering to Arisun Chat!\n\nComplete your registration process by verifying your account with the code below:\n\n${otp}\n\nIf you did not request this code, please safely ignore this message.\n\nFor your account security, do not share this code with anyone.`
    };

    await transporter.sendMail(mailOptions);

    res.json({
      message: 'OTP sent to email',
      requiresVerification: true 
    });

  } catch (err) {
    console.error("❌ REGISTRATION CRASH:", err);
    res.status(500).json({ error: 'Register failed' });
  }
};

// -------------------------
// 2. VERIFY OTP
// -------------------------
exports.verifyEmail = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp;

    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.isVerified) return res.status(400).json({ error: 'User is already verified.' });

    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid OTP code.' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ error: 'OTP has expired. Please register again.' });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({
      message: 'Email verified successfully',
      token: generateToken(user),
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        publicKey: user.publicKey,
        signPublicKey: user.signPublicKey,
        primaryVault: user.primaryVault,
        recoveryVault: user.recoveryVault
      }
    });

  } catch (err) {
    console.error("❌ OTP VERIFY CRASH:", err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// -------------------------
// 3. LOGIN
// -------------------------
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username) return res.status(400).json({ error: 'Username or Email required' });
    
    const cleanInput = username.trim().toLowerCase();

    const user = await User.findOne({ 
      $or: [{ username: username.trim() }, { email: cleanInput }] 
    });

    if (!user) return res.status(400).json({ error: 'User not found' });
    if (!user.isVerified) return res.status(403).json({ error: 'Please verify your email before logging in.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Wrong password' });

    res.json({
      token: generateToken(user),
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        publicKey: user.publicKey,
        signPublicKey: user.signPublicKey,
        primaryVault: user.primaryVault,
        recoveryVault: user.recoveryVault
      }
    });

  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
};

// -------------------------
// 4. GET ME
// -------------------------
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp -otpExpires -resetPasswordToken -resetPasswordExpires');
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
};

// -------------------------
// 5. FORGOT PASSWORD
// -------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase(); 
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'No account found with that email address.' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const clientUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Arisun Chat — Password Reset Request',
      text: `We received a request to reset your password.\n\nClick the link below to set a new password. This link is valid for 1 hour:\n\n${resetUrl}\n\nIf you did not request this, please safely ignore this email and your password will remain unchanged.`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Password reset link sent to your email.' });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: 'Failed to process request.' });
  }
};

// -------------------------
// 6. RESET PASSWORD
// -------------------------
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body; 

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) return res.status(400).json({ error: 'Token is invalid or has expired.' });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    // Note: We DO NOT wipe the primaryVault here yet. The user will use their recovery phrase
    // to decrypt the recoveryVault and re-encrypt the primaryVault in the frontend.
    await user.save();

    res.status(200).json({ message: 'Password has been successfully reset.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};