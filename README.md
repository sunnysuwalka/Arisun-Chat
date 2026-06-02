# 🌅 Arisun

Arisun is a premium, real-time communication platform built with a focus on high-fidelity UI, seamless WebRTC audio/video calling, and a clean, minimalist Apple-style aesthetic. 

## ✨ Core Features

* **High-Quality WebRTC Calling:** Peer-to-peer audio and video calls powered by custom WebRTC architecture, complete with STUN server configurations for NAT traversal.
* **Smart Call Overlay:** A custom, responsive UI overlay that handles incoming/outgoing call states, ringing/ringtone audio loops, and a strict 31-second auto-disconnect protocol for unanswered calls.
* **Real-Time Messaging:** Instant message delivery powered by WebSockets (`Socket.io`), featuring online status tracking and unread message indicators.
* **Invisible Call Logging:** A custom decoding system that seamlessly formats hidden JSON call logs (`📞CALL_LOG::`) into clean UI elements (e.g., "Missed audio call") across both the chat window and sidebar.
* **Friend System & Search:** Integrated user search, live pending request management (accept/decline), and a unified active contacts list.
* **Premium UI/UX:** Built with Tailwind CSS, featuring a responsive mobile-first design, fluid transitions, dark-mode elements (`#1C1C1E`), and perfectly contrasted typography.

## 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS
* **State Management:** Zustand (`useChatStore`, `useAuthStore`)
* **Real-Time Communication:** Socket.io-client
* **A/V Streaming:** Native WebRTC API (`RTCPeerConnection`, `getUserMedia`)
* **Backend Integration:** RESTful API via Axios, Socket events for signaling
* **Icons & Notifications:** Lucide-React / Custom SVGs, React-Hot-Toast

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository:**
```bash
   git clone [https://github.com/YOUR_USERNAME/arisun-app.git](https://github.com/YOUR_USERNAME/arisun-app.git)
   cd arisun-app