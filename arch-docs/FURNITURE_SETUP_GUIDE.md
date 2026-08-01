# Furniture Showroom - 3D Setup Guide

## Overview
This guide explains how to prepare and name 3D models for the furniture showroom system.

---

## 1. 3D Model Naming Requirements

### Root Object Name
- **Must match the product key** in `products.json`
- Example: If product key is `"modern-sofa"`, name the root object `modern-sofa`
- Case-insensitive matching supported

### Colorable Mesh Names
Meshes that should change color **must include one of these keywords** in their name:

- `fabric`
- `cushion`
- `upholstery`
- `seat`

**Examples:**
```
✅ sofa_fabric_001
✅ cushion_left
✅ seat_upholstery
✅ fabric-material
❌ sofa_frame (won't be colorable)
❌ wood_legs (won't be colorable)
```

### Hierarchy
- Colorable meshes can be **at any depth** in the hierarchy
- System traverses entire object tree automatically
- Parent/child relationships don't matter, only mesh names

**Example Structure:**
```
modern-sofa (root)
├── frame
│   ├── wood_legs
│   └── metal_support
└── seating
    ├── cushion_left (colorable ✅)
    ├── cushion_right (colorable ✅)
    └── fabric_base (colorable ✅)
```

---

## 2. Products Configuration

### File: `public/config/products.json`

```json
{
  "modern-sofa": {
    "id": "modern-sofa-01",
    "category": "seating",
    "type": "sofa",
    "name": "Modern Sectional Sofa",
    "glbPath": "/models/furniture/sofa-modern.glb",
    "usdzPath": "/models/furniture/sofa-modern.usdz",
    "dimensions": "240cm × 95cm × 80cm",
    "material": "Fabric & Solid Wood",
    "weight": "85 kg",
    "colors": [
      { "name": "Charcoal Gray", "hex": "#36454F" },
      { "name": "Beige", "hex": "#D4C5B9" },
      { "name": "Navy Blue", "hex": "#1B2F5C" }
    ],
    "billboardPosition": [2, 2.5, 0]
  }
}
```

**Key Requirements:**
- Product **key** (e.g., `"modern-sofa"`) = 3D object root name
- `glbPath`: Model for web/Android AR
- `usdzPath`: Model for iOS AR Quick Look
- `colors`: Array of 3+ color options with name and hex
- `billboardPosition`: [x, y, z] for info popup location

---

## 3. Store Configuration

### File: `public/config/stores.json`

```json
{
  "stores": [
    {
      "id": "mall",
      "files": [
        {
          "priority": 0,
          "quality": "low",
          "url": "/store-models/mall-collision.glb"
        },
        {
          "priority": 1,
          "quality": "high",
          "url": "/store-models/mall-furniture.glb"
        }
      ]
    }
  ]
}
```

---

## 4. Model Export Settings

### Blender Export (Recommended)
1. **Format**: glTF 2.0 (.glb)
2. **Include**: Selected Objects
3. **Transform**: +Y Up
4. **Geometry**:
   - Apply Modifiers: ✅
   - UVs: ✅
   - Normals: ✅
   - Materials: Export
5. **Compression**: Draco (optional, for smaller files)

### Material Setup
- Use **MeshStandardMaterial** or **MeshPhysicalMaterial**
- Set base color for colorable meshes (will be captured as "Original")
- Avoid baked textures on colorable parts

---

## 5. Testing Checklist

Before adding furniture to the scene:

- [ ] Root object named to match product key
- [ ] Colorable meshes contain keywords: fabric/cushion/upholstery/seat
- [ ] Products.json entry created with matching key
- [ ] GLB and USDZ files exported and placed in correct paths
- [ ] Colors array has at least 3 color options
- [ ] Billboard position tested in scene

---

## 6. How It Works

### On Click:
1. User clicks furniture
2. System finds object by name matching product key
3. Traverses hierarchy to find meshes with colorable keywords
4. Captures original color from first mesh
5. Shows color picker with "Original" + defined colors

### Color Change:
1. User clicks color circle
2. System applies smooth color transition (400ms)
3. Only affects meshes with fabric/cushion/upholstery/seat in name
4. Other parts (frame, legs, etc.) unchanged

### AR View:
1. User clicks "VIEW IN AR" button
2. Opens ARProductViewer with GLB (Android/web) or USDZ (iOS)
3. Native AR experience: Quick Look or Scene Viewer

---

## 7. Common Issues

**Color not changing:**
- Check mesh names contain keywords: fabric/cushion/upholstery/seat
- Verify object root name matches product key exactly
- Check console logs for "Found X meshes, Y colorable"

**Multiple furniture changing color:**
- Each furniture must have unique root object name
- Root name must match product key in products.json

**AR not working:**
- Verify both glbPath and usdzPath are correct
- Test on actual device (AR doesn't work in desktop browser)
- Check file sizes (recommend <10MB for AR models)

---

## 8. File Structure

```
/models/furniture/
├── sofa-modern.glb          (Web/Android)
├── sofa-modern.usdz         (iOS AR)
├── chair-nordic.glb
├── chair-nordic.usdz
└── ...

/store-models/
├── mall-collision.glb       (Invisible collision mesh)
└── mall-furniture.glb       (Visual scene with furniture)

/public/config/
├── products.json            (Furniture catalog)
└── stores.json              (Scene configuration)
```

---

## Need Help?

Check browser console for detailed logs:
- `[FurnitureColorApplier]` - Object finding and mesh traversal
- `[ProductInteraction]` - Click detection and product matching
- `[Scene]` - Furniture selection flow

All systems include extensive debug logging to help troubleshoot issues.
