# 🌅 Arisun

Arisun is a premium, real-time communication platform built with a focus on high-fidelity UI, military-grade security, seamless WebRTC audio/video calling, and a clean, minimalist Apple-style aesthetic. 

**[Live Demo](https://your-vercel-link-here.vercel.app) | [Backend API](https://your-render-link-here.onrender.com)**

## ✨ Core Features

* **Military-Grade E2EE:** Total zero-knowledge architecture powered by the Signal Protocol stack (Curve25519 & Ed25519 via TweetNaCl). Messages are mathematically locked in encrypted vaults and completely unreadable by the server. Includes secure recovery phrase backup.
* **Infinite Scroll Pagination:** Highly optimized chat engine that fetches history 50 messages at a time, utilizing "Freeze Scroll" mathematics to ensure the UI never jumps or stutters while loading massive chat histories.
* **High-Quality WebRTC Calling:** Peer-to-peer audio and video calls powered by a custom WebRTC architecture, complete with STUN server configurations for NAT traversal.
* **Smart Call Overlay:** A custom, responsive UI overlay that handles incoming/outgoing call states, ringing/ringtone audio loops, and a strict 31-second auto-disconnect protocol for unanswered calls.
* **Real-Time Messaging & Toasts:** Instant message delivery powered by WebSockets (`Socket.io`). Features native top-left UI toasts with avatars and precise E2EE message previews (Photo, Video, Audio) when backgrounded.
* **Secure Authentication:** JWT-based auth combined with OTP Email Verification (NodeMailer) and secure password recovery pipelines.
* **Invisible Call Logging:** A custom decoding system that seamlessly formats hidden JSON call logs (`📞CALL_LOG::`) into clean UI elements across both the chat window and sidebar.
* **Premium UI/UX:** Built with Tailwind CSS, featuring a responsive mobile-first design, fluid transitions, dark-mode elements (`#1C1C1E`), and perfectly contrasted typography.

## 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS
* **State Management:** Zustand (`useChatStore`, `useAuthStore`)
* **Cryptography Engine:** Web Crypto API, TweetNaCl (Curve25519)
* **Real-Time Communication:** Socket.io-client
* **A/V Streaming:** Native WebRTC API (`RTCPeerConnection`, `getUserMedia`)
* **Backend:** Node.js, Express, MongoDB (Mongoose)
* **Icons & Notifications:** Lucide-React / Custom SVGs, React-Hot-Toast

## 🚀 Getting Started

### Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/sunnysuwalka/Arisun-Chat
cd arisun-app