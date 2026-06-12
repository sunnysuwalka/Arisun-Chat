const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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
    const { username, email, password, avatar, publicKey, signPublicKey, primaryVault, encryptedMasterKey, pinSalt } = req.body;

    if (!email || !username) return res.status(400).json({ error: 'Username and Email required' });
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    let existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });

    const hashed = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 15 * 60 * 1000; // 15 mins

    let user;

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ error: 'User with this email or username already exists' });
      } else {
        existingUser.password = hashed;
        existingUser.otp = otp;
        existingUser.otpExpires = otpExpires;
        if (avatar) existingUser.avatar = avatar; 
        
        if (publicKey) existingUser.publicKey = publicKey;
        if (signPublicKey) existingUser.signPublicKey = signPublicKey;
        if (primaryVault) existingUser.primaryVault = primaryVault;
        if (encryptedMasterKey) existingUser.encryptedMasterKey = encryptedMasterKey;
        if (pinSalt) existingUser.pinSalt = pinSalt;
        
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
        encryptedMasterKey: encryptedMasterKey || null,
        pinSalt: pinSalt || null
      });
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_USER, name: "Arisun Chat" },
        to: [{ email: user.email }],
        subject: "Arisun Chat — Verify Your Account",
        htmlContent: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #1C1C2E;">
            <h2 style="color: #007AFF;">Welcome to Arisun!</h2>
            <p>Thank you for registering. Please complete your registration process by verifying your account with the code below:</p>
            <div style="background-color: #F5F7FB; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h1 style="letter-spacing: 5px; margin: 0; color: #1C1C2E;">${otp}</h1>
            </div>
            <p style="font-size: 14px; color: #666;">This code will expire in 15 minutes.</p>
            <p style="font-size: 14px; color: #666;">If you did not request this, please safely ignore this message.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ BREVO API ERROR (Register):", errorData);
      throw new Error("Failed to send OTP email via Brevo API");
    }

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
        encryptedMasterKey: user.encryptedMasterKey,
        pinSalt: user.pinSalt
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
        encryptedMasterKey: user.encryptedMasterKey,
        pinSalt: user.pinSalt
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
// 5. FORGOT PASSWORD (USERNAME BASED)
// -------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const username = req.body.username?.trim(); 
    if (!username) return res.status(400).json({ error: 'Username is required.' });

    // Look up the user by their username (case-insensitive for safety)
    const user = await User.findOne({ 
      username: { $regex: `^${username}$`, $options: 'i' } 
    });

    if (!user) return res.status(404).json({ error: 'No account found with that username.' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const clientUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // Send to the email attached to their username account
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_USER, name: "Arisun Chat" },
        to: [{ email: user.email }],
        subject: "Arisun Chat — Password Reset Request",
        htmlContent: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #1C1C2E;">
            <h2 style="color: #007AFF;">Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to set a new password. This link is valid for 1 hour:</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">If you did not request this, please safely ignore this email and your password will remain unchanged.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ BREVO API ERROR (Forgot Password):", errorData);
      throw new Error("Failed to send reset email via Brevo API");
    }

    // Mask the email so the frontend can securely display "j***@gmail.com"
    const [namePart, domainPart] = user.email.split('@');
    const maskedEmail = `${namePart.charAt(0)}***@${domainPart}`;

    res.status(200).json({ 
      message: 'Password reset link sent to your registered email.',
      email: maskedEmail // Sent to frontend to populate the UI
    });

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
    
    // Note: We DO NOT wipe the primaryVault here yet. The user will use their 6-digit PIN
    // to decrypt the encryptedMasterKey and re-encrypt the primaryVault in the frontend.
    await user.save();

    res.status(200).json({ message: 'Password has been successfully reset.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};

// -------------------------
// 7. REAL-TIME AVAILABILITY CHECK
// -------------------------
exports.checkAvailability = async (req, res) => {
  try {
    const { username, email } = req.body;
    let usernameTaken = false;
    let emailTaken = false;

    // Check Username (Case-Insensitive Exact Match using standard MongoDB syntax)
    if (username) {
      const existingUser = await User.findOne({ 
        username: { $regex: `^${username.trim()}$`, $options: 'i' } 
      });
      if (existingUser) usernameTaken = true;
    }

    // Check Email (Case-Insensitive Exact Match)
    if (email) {
      const existingEmail = await User.findOne({ 
        email: { $regex: `^${email.trim()}$`, $options: 'i' } 
      });
      if (existingEmail) emailTaken = true;
    }

    res.json({ usernameTaken, emailTaken });
  } catch (err) {
    console.error("Availability Check Error:", err);
    res.status(500).json({ error: 'Failed to check availability' });
  }
};