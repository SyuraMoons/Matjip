# Memory Feature Documentation

## Overview

The **Add Memory** feature allows users to:
1. **Upload or drag photos** from their device
2. **Add captions and details** about the memory
3. **Choose a visual emoji** pin for their location
4. **Set the exact location** on the interactive map
5. **Save memories** with automatic pin placement on the map

## Components

### 1. **AddMemoryModal.tsx** 
Multi-step modal for adding new memories with a smooth, guided experience.

**Features:**
- **Step 1 - Photos**: Drag & drop or click to upload multiple photos
- **Step 2 - Details**: Add title, caption, and select emoji
- **Step 3 - Location**: Click on map to set exact coordinates or manually enter location name
- Real-time validation and progress indicators

**Props:**
```typescript
type AddMemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: MemoryData) => void;
  map: L.Map | null;
  currentLocation?: { lat: number; lng: number };
};
```

### 2. **Map.tsx** (Updated)
Enhanced map component that manages memory markers and integrates the modal.

**New Features:**
- State management for memories using React hooks
- Dynamic marker creation and removal
- "Add Memory" button in the bottom-left corner
- Memory counter badge in the bottom-right corner
- Photo thumbnails in memory popups

## Usage

### Basic Flow

1. **Click "✨ Add Memory" button** (bottom-left of map)
2. **Upload photos** by dragging or clicking
3. **Fill in details**:
   - Memory title (required)
   - Caption/message (optional)
   - Select an emoji pin
4. **Set location**:
   - Click on the map to place the pin
   - Optionally add location name
5. **Click "💾 Save Memory"**
6. The pin appears on the map at the saved coordinates

### MemoryData Type

```typescript
type MemoryData = {
  id: number;
  title: string;
  caption: string;
  date: string;
  location: string;
  lat: number;
  lng: number;
  photos: string[]; // Base64 encoded photos
  emoji: string;
};
```

## Styling

The feature uses your existing **dark theme with purple accents**:

- **Background**: `#0a0f1e` (dark navy)
- **Cards**: `rgba(17, 24, 39, 0.97)` (darker navy with transparency)
- **Primary Accent**: `#8b5cf6` (purple)
- **Text**: `#f9fafb` (off-white)
- **Borders**: Purple with 30-40% opacity

### Color Palette Used
- **Dark**: `#0a0f1e`, `#141c2e`, `#1e2d4a`
- **Purple**: `#8b5cf6`, `#a78bfa`, `#c4b5fd`
- **Gray**: `#9ca3af`, `#d1d5db`, `#e5e7eb`, `#f9fafb`

## Interactive Elements

### Buttons
- **Add Memory Button**: Gradient purple with hover scale effect
- **Navigation Buttons**: Smooth transitions between steps
- **Emoji Selector**: Click to toggle, highlights selected emoji

### Inputs
- **File Upload**: Drag-over visual feedback
- **Text Inputs**: Focus ring with purple accent
- **Map Picker**: Click to place marker, shows coordinates

## Emoji Suggestions

Default emoji options for memory pins:
```
🏖️ 🌅 🏔️ 🧭 🌆 🗻 🎭 🍜 🎪 🌃 ✈️ 🚀 ⛪ 🕌 🏯 🗼 🌲 🌴 🐘 🦁
```

Users can select any emoji to represent their memory location.

## Advanced Features

### Photo Management
- **Drag & Drop Support**: Full drag-and-drop functionality
- **Multiple Photos**: Upload up to any number of photos
- **Preview Grid**: 4-column grid with scroll support
- **Remove Photos**: Hover and click ✕ to remove individual photos
- **First 3 Photos**: Displayed in memory popup

### Location Picking
- **Interactive Map**: Uses Leaflet with dark theme
- **Click to Place**: One click sets coordinates
- **Marker Updates**: Shows selected location in real-time
- **Coordinate Display**: Shows lat/lng with 4 decimal places
- **Location Name**: Optional text field for location description

### State Management
- All memories stored in component state
- Sample memories pre-populated
- New memories added to the Map automatically
- Markers update in real-time when memories change

## Customization Guide

### Adding More Emoji Options

Edit `EMOJI_SUGGESTIONS` in `AddMemoryModal.tsx`:
```typescript
const EMOJI_SUGGESTIONS = [
  "🏖️", "🌅", "🏔️", // ... add more
];
```

### Changing Colors

Update the Tailwind classes and inline styles in `AddMemoryModal.tsx`:
- `from-purple-600` → Change primary color
- `bg-slate-900` → Change background
- `border-purple-500` → Change border accent

### Persisting Data

To save memories to a database, modify `handleSaveMemory` in `Map.tsx`:
```typescript
const handleSaveMemory = async (memory: MemoryData) => {
  // Call your API
  const response = await fetch('/api/memories', {
    method: 'POST',
    body: JSON.stringify(memory),
  });
  // Update state
  setMemories((prev) => [...prev, memory]);
};
```

## Performance Considerations

1. **Photo Storage**: Photos are stored as Base64 strings - consider compression for large images
2. **Marker Optimization**: Currently rebuilds all markers when memories change
3. **Map Picker**: Uses Stadia Maps free tier tiles - consider upgrading for production

## Future Enhancements

- [ ] Edit existing memories
- [ ] Delete memories
- [ ] Memory filters by date/location
- [ ] Photo gallery modal
- [ ] Memory clustering on zoom
- [ ] Timeline view
- [ ] Photo compression before saving
- [ ] Local storage persistence
- [ ] Database integration

## Troubleshooting

### Photos not showing?
- Check browser console for Base64 encoding errors
- Ensure images are less than 5MB for optimal performance

### Map picker not loading?
- Click "Load Map" button if it doesn't auto-initialize
- Check network connectivity for tile layer

### Markers disappearing?
- Check that popupAnchor and iconAnchor offsets are correct
- Verify latitude/longitude values are within valid ranges (-90 to 90, -180 to 180)

## Browser Compatibility

- Modern browsers with Leaflet support (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Drag & Drop support for modern browsers

## Dependencies

- `leaflet`: ^1.9.4 - Map library
- `react`: ^19.2.4 - UI framework
- `next`: ^16.2.3 - Framework
- `tailwindcss`: ^4 - Styling
