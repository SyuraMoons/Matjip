# Matjip Demo Video Script

## [0:00-0:30] HOOK / PROBLEM STATEMENT

**Problem:**
"Think about your last trip. You took beautiful photos, visited amazing places, discovered hidden gems. But where are those memories now?

Scattered across your phone. Lost in photo apps. Stuck in private folders. Maybe posted to Instagram, but buried under thousands of other posts with no context.

**Here's the real problem:** Travel apps today are centralized and fragmented. Your local café review goes to Google. Your travel photos go to Instagram. Your location data goes to a tech company. None of it connects. None of it rewards you for contributing quality information.

And there's no way to build a **shared, decentralized knowledge graph** of real-world experiences that belongs to the community—not a corporation."

---

## [0:30-1:15] SOLUTION OVERVIEW: INTRODUCING MATJIP

**What is Matjip?**
"Matjip is a **decentralized, location-based memory platform** that turns your travel experiences into a shared community resource. Think of it as Wikipedia for travel memories—crowdsourced, decentralized, and community-rewarded.

**How it works:**
1. **Add memories** with photos, descriptions, and location data—no censorship, no corporate control
2. **See connected groups** of memories on an interactive, beautiful map
3. **Earn karma rewards** based on how your memories cluster and contribute to zones
4. **Zone-based multiplier system** that incentivizes creating rich clusters of related memories

**The innovation:** When your memories connect with other community members' memories—based on proximity and time—they form **karma zones**. These zones have levels and multipliers that reward you for contributing to specific geographic areas.

The more memories in a zone, the larger the span they cover, the higher your multiplier. It's community-driven, blockchain-backed, and designed to reward quality contributions at scale."

---

## [1:15-3:00] WALKTHROUGH: HOW IT WORKS

### Step 1: Sign In & Locate (10 seconds)
"First, you connect your wallet. Matjip is blockchain-integrated, so your memories are linked to your identity and rewards."

**Show on screen:**
- Wallet connection popup (AppKit)
- Approve connection
- "You are here" blue marker appears with pulse animation
- Map centered on user location at zoom level 17

**Narration:**
"The app uses your geolocation. You can see your exact position on the map. Everything is now private to your wallet address—only you own your memories."

---

### Step 2: Add Your First Memory (15 seconds)
"Let's create a memory. I'll click the add button."

**Show on screen:**
- Memory modal opens with smooth animation
- Fill in fields one by one:
  - Title: "Cozy Coffee Shop in Hongdae"
  - Emoji: ☕
  - Location: Auto-filled from map
  - Date: Today
  - Caption: "Amazing espresso and vintage aesthetic. Hidden gem on the backstreets."
  - Upload a photo (show file picker, photo appears)
- Click "Save Memory"

**Narration:**
"You add all the details about your experience. The location is automatically captured from where you are or where you point on the map. Photos are encrypted and stored on IPFS—decentralized, permanent, and censorship-resistant."

---

### Step 3: Memory Appears on Map (8 seconds)
"Once saved, the memory appears as a pin on the map."

**Show on screen:**
- Purple pin appears with marker icon
- Zoom smooth animation slightly
- Light purple circle around the pin (place scale for café)

**Narration:**
"You see a circle around it—that's the 'place scale'. For a café, it's smaller (~60 meters). For a landmark or park, it's larger. This represents the geographic area of significance for that memory."

---

### Step 4: Add a Second Memory (12 seconds)
"Let's add another memory nearby—a bookstore a short walk away."

**Show on screen:**
- Click add button again
- Fill in: Title "Vintage Bookstore", emoji 📚, location ~300m away, date same day
- Save
- Second pin appears
- Route corridor appears connecting the two pins (subtle gray line showing the path between them)

**Narration:**
"When you add a second memory close in time and location, something interesting happens. The app detects the connection and draws a route corridor between them—showing your travel path. This is real routing data from the street network, not just a straight line."

---

### Step 5: Build a Cluster (20 seconds)
"Let's add a few more memories to create a zone. This is where karma multipliers start to matter."

**Show on screen:**
- Add 2-3 more memories quickly:
  - "Lunch at Korean BBQ" 🍖 (~200m away)
  - "Visited Street Art Alley" 🎨 (~400m away)
- Each pin appears sequentially
- Route corridors connect them in chronological order
- Zoom out slightly to see the cluster forming

**Narration:**
"As you add more memories, you're building a cluster. The app is tracking:
- **Time proximity**: Memories close together in time
- **Location proximity**: Memories within 1.5km radius
- **Chronological order**: The sequence you visited them

When enough memories cluster together, they form a karma zone—and that's where the rewards kick in."

---

### Step 6: Karma Zone Multipliers REVEALED (25 seconds)
"Watch what happens when we add one more memory..."

**Show on screen:**
- Purple aura circle suddenly appears/expands around the entire cluster
- 72x72 badge appears at the center showing:
  - Top: Karma count (e.g., "5")
  - Middle: Zone level (e.g., "L2")
  - Bottom: Multiplier (e.g., "1.5x")
- Zoom in on badge to show it clearly

**Narration:**
"A karma zone was created! Here's how the levels work:

**Level 1** (1.3x multiplier): You need **3+ memories** AND they must span **400+ meters**
**Level 2** (1.5x multiplier): You need **5+ memories** AND they must span **700+ meters**
**Level 3** (2.0x multiplier): You need **7+ memories** AND they must span **1000+ meters**

In this case, we have 5 memories spanning about 800 meters. That's a **Level 2 zone with a 1.5x multiplier**.

When you add the *next* memory to this zone, it will earn **1.5x karma points** instead of the base amount. It's the app's way of saying: 'We reward you for building rich, interconnected experience clusters.'"

---

### Step 7: Show Zone Details on Hover/Click (12 seconds)
"You can click the zone to see all the memories in it."

**Show on screen:**
- Click or hover on karma badge
- Popup shows:
  - Zone level and span distance
  - List of 5 memories in the zone
  - Multiplier applied
- Or show in console: `[Zone] Computing level: size=5, span=850m`

**Narration:**
"The system automatically calculated the maximum distance between any two memories in the zone (850 meters) and assigned the level based on that. This is precise geographic data, not approximations."

---

### Step 8: Explore & Compare with Other Users (12 seconds)
"Now let's see what others in the community have contributed."

**Show on screen:**
- Switch wallet or show filter to view another user's memories
- See different colored zones or markers
- Show multiple karma zones from different users/wallets
- Zoom out to global view showing zones across a city

**Narration:**
"This is the real power of Matjip. You're looking at a **shared, global memory map** built by the community. Each zone represents concentrated local knowledge—discovered restaurants, cultural landmarks, hidden gems. All decentralized. All rewarded."

---

## [1:30-1:50] TECH HIGHLIGHTS (Optional, for technical audience)

- **Decentralized Storage**: Memories are stored on IPFS via Pinata; metadata on blockchain
- **Union-Find Algorithm**: Detects connected components (groups of memories)
- **Haversine Distance**: Accurate geographic span calculation
- **Leaflet.js**: Interactive map visualization
- **Blockchain Rewards**: Karma system integrated with smart contracts
- **Real Route Geometry**: Uses OSRM API to show actual travel paths

---

## [3:00-3:30] TECH ARCHITECTURE & USE CASES

### Technical Stack (10 seconds)
"Under the hood, here's what makes Matjip work:"

**Show on screen:**
- Brief tech stack overlay or console logs:
  - IPFS + Pinata: Photo & metadata storage
  - Blockchain: Karma ledger, wallet identity
  - Leaflet.js: Interactive map
  - OSRM API: Real route geometry

**Narration:**
"Photos and metadata are stored on IPFS via Pinata—no single company controls it. Your karma score is recorded on-chain, so it's transparent and portable. The map uses Leaflet and renders real routing data from OSRM, not just straight lines."

---

### Real-World Use Cases (10 seconds)

**Show on screen:**
- Text overlay of use cases:
  - 🏨 Hotel staff add detailed reviews with photos
  - 🍽️ Foodies build neighborhood food guide
  - 🗺️ Travel communities create shared experiences
  - 🚶 Urban explorers map hidden gems

**Narration:**
"Imagine the applications: 

A hotel concierge adding local restaurant reviews gets rewarded. A food blogger building a neighborhood guide earns karma multipliers. Urban explorers mapping street art get recognized by the community. Everyone shares in a system that values *their* knowledge, not a corporation's algorithm."

---

### The Reward Loop (10 seconds)

**Narration:**
"The brilliance is the incentive structure:

1. **You contribute quality memories** → They get stored decentralized
2. **Your memories cluster with others** → A zone forms
3. **Zone reaches higher levels** → Your multiplier increases
4. **You earn rewards** → Redeemable in the community
5. **Community grows** → More memories, better map, higher value

It's a flywheel. You're not just using an app—you're building a global knowledge commons that rewards participation."

---

---

## [3:30-3:45] CLOSING / CALL TO ACTION

**Narration:**
"Matjip is a new way to think about travel. Your memories aren't just photos on your phone. They're contributions to a shared global map. They're investments in a community that values your perspective.

No corporation owns it. No algorithm buries it. Just you, the community, and the world's travel experiences—decentralized, rewarded, and forever."

**Show on screen:**
- Drone shot or wide map view of multiple zones
- Website/socials: "www.matjip.app"
- Call to action: "Connect your wallet. Share your story. Earn rewards."

**Final tagline:**
"**Matjip: The Decentralized Memory Map. Community-Owned. Reward-Driven. Global.**"

---

## TIMING BREAKDOWN FOR 3-MINUTE VIDEO

| Section | Duration | Total Time |
|---------|----------|-----------|
| Problem Statement | 30 sec | 0:30 |
| Solution Overview | 45 sec | 1:15 |
| Demo Walkthrough | 105 sec (1:45) | 3:00 |
| Tech + Use Cases | 30 sec | 3:30 |
| Closing + CTA | 15 sec | 3:45 |
| **TOTAL** | **~3 minutes 45 seconds** | |

---

## PRO TIPS FOR RECORDING 3-MINUTE VIDEO

### Pacing Strategy
✅ **Problem Statement (0:00-0:30)**: Speak slower, let the pain point sink in. Show fragmented apps/photos
✅ **Solution (0:30-1:15)**: Energetic, highlight "decentralized" + "rewards" - this is the hook
✅ **Walkthrough (1:15-3:00)**: This is your stage! Take time with each memory addition, let zones form naturally
✅ **Tech + Closing (3:00-3:45)**: Brisk, confident, end on a high note

### Visual Production Tips
🎥 **Smooth Transitions**: Use map pan/zoom animations between steps (feels polished)
🎥 **Zoom on Details**: When showing the 72x72 badge, zoom in so text is readable
🎥 **Show Routes Appearing**: Animate the route corridor appearing - very satisfying moment
🎥 **Highlight Zone Formation**: Pause or slow down when the purple aura appears - this is the "wow" moment
🎥 **Console Logs**: Show browser devtools with [Zone] and [Reward] logs for credibility with tech audience
🎥 **Multiple Angles**: Include: map overview, zoomed detail view, wide shot with multiple zones

### Audio Production
🎵 **Background Music**: 
  - 0:00-0:30: Contemplative, problem-setting music
  - 0:30-3:00: Upbeat, modern tech vibe (no lyrics)
  - 3:00-3:45: Inspiring, building to crescendo
🔊 **Sound Effects**:
  - Memory saved: subtle "ping" or "whoosh"
  - Zone created: satisfying "chime" or "expand" sound
  - Badge appears: soft glow/shimmer effect
🎤 **Voiceover**: Clear, natural pace. Emphasize key terms like "decentralized," "rewards," "community"

### Story Arc
📖 **Act 1 (Problem)**: Make the pain relatable - scattered photos, lost memories
📖 **Act 2 (Solution)**: Build anticipation for the demo
📖 **Act 3 (Demo)**: Payoff - show how smoothly it works, build to zone moment
📖 **Act 4 (Vision)**: End with the bigger picture - global community

### Key Moments to Highlight
⭐ **0:30**: "Centralized and fragmented" - show problem
⭐ **1:15**: First memory appears on map - "It's working!"
⭐ **1:45**: Route corridor connects memories - "It's connected!"
⭐ **2:15**: Purple zone forms - "BOOM! This is the feature!"
⭐ **2:45**: Badge shows L2, 1.5x - "The reward system works!"
⭐ **3:00**: Multiple user zones visible - "Community is building this"

---

## QUICK REFERENCE: SPEAKING POINTS BY SECOND

```
0:00 - "Think about your last trip..."
0:15 - "...stuck in private folders"
0:30 - "HERE'S THE REAL PROBLEM: Centralized apps..."
1:00 - "Introducing Matjip..."
1:30 - "First, you connect your wallet..."
1:45 - "Let's add a memory..."
2:00 - "Once saved, it appears on the map..."
2:15 - "Let's add more memories..."
2:30 - "A zone is created!"
2:45 - "Here's how the levels work..."
3:00 - "Now let's see what others contributed..."
3:15 - "Under the hood..."
3:30 - "Real-world use cases..."
3:45 - "Matjip: The Decentralized Memory Map"
```

---

## FINAL CHECKLIST BEFORE RECORDING

- [ ] Wallet is funded and ready to connect
- [ ] Geolocation is enabled on device
- [ ] Have 5+ good photos ready to upload
- [ ] Test map loading and performance
- [ ] Record in good lighting
- [ ] Use external mic for clear audio
- [ ] Do a full run-through before final recording
- [ ] Capture screen at 1080p or 4K
- [ ] Record backup audio separately if possible
- [ ] Test music/voiceover timing
- [ ] Have B-roll of map zooming/panning ready
