const vertexSource = `#version 300 es
in vec2 a_position;
uniform mat3 u_camera;
uniform vec2 u_position;
uniform vec2 u_scale;
out vec2 v_uv;
void main() {
  vec3 point = u_camera * vec3(a_position * u_scale + u_position, 1.0);
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(point.xy, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec4 u_color;
uniform vec4 u_color_b;
uniform float u_gradient;
uniform vec2 u_gradient_center;
uniform float u_gradient_scale;
uniform float u_gradient_rotation;
uniform float u_ramp;
uniform float u_ramp_midpoint;
uniform float u_scalar_preview;
uniform vec4 u_field_operations[8];
uniform int u_field_operation_count;
uniform float u_time;
uniform vec4 u_adjust;
uniform float u_brightness;
uniform vec4 u_vignette;
uniform vec4 u_vignette_color;
uniform vec4 u_pattern;
uniform vec4 u_pattern_color;
uniform float u_pattern_rotation;
uniform vec2 u_resolution;
uniform vec4 u_blend;
uniform vec4 u_blend_color;
uniform vec4 u_blend_color_b;
uniform float u_blend_gradient;
uniform vec2 u_blend_gradient_center;
uniform float u_blend_gradient_scale;
uniform float u_blend_gradient_rotation;
uniform vec4 u_blend_procedural;
uniform vec4 u_blend_procedural_options;
uniform vec2 u_blend_procedural_shape;
uniform vec4 u_blend_field_warp;
uniform float u_blend_ramp;
uniform float u_blend_ramp_midpoint;
uniform vec4 u_blend_field_operations[8];
uniform int u_blend_field_operation_count;
uniform vec4 u_blend_pattern;
uniform vec4 u_blend_pattern_color;
uniform float u_blend_pattern_rotation;
uniform vec4 u_blend_adjust;
uniform float u_blend_brightness;
uniform vec4 u_blend_glow;
uniform vec4 u_blend_glow_color;
uniform vec2 u_blend_chromatic;
uniform vec4 u_blend_grain;
uniform vec4 u_blend_vignette;
uniform vec4 u_blend_vignette_color;
uniform vec2 u_blend_mask;
uniform vec2 u_blend_blur;
uniform vec2 u_mask;
uniform vec2 u_blur;
uniform vec4 u_procedural;
uniform vec4 u_procedural_options;
uniform vec2 u_procedural_center;
uniform vec2 u_procedural_shape;
uniform vec4 u_field_warp;
uniform vec4 u_glow;
uniform vec4 u_glow_color;
uniform vec2 u_chromatic;
uniform vec4 u_grain;
uniform vec4 u_displacement;
out vec4 outColor;
vec3 hueRotate(vec3 color, float angle) {
  float c = cos(angle); float s = sin(angle);
  mat3 matrix = mat3(0.213 + c * 0.787 - s * 0.213, 0.213 - c * 0.213 + s * 0.143, 0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 - s * 0.715, 0.715 + c * 0.285 + s * 0.140, 0.715 - c * 0.715 + s * 0.715,
    0.072 - c * 0.072 + s * 0.928, 0.072 - c * 0.072 - s * 0.283, 0.072 + c * 0.928 + s * 0.072);
  return clamp(matrix * color, 0.0, 1.0);
}
vec3 blendColor(vec3 base, vec3 overlay, float mode) {
  if (mode < 0.5) return overlay;
  if (mode < 1.5) return base * overlay;
  if (mode < 2.5) return 1.0 - (1.0 - base) * (1.0 - overlay);
  if (mode < 3.5) return mix(2.0 * base * overlay, 1.0 - 2.0 * (1.0 - base) * (1.0 - overlay), step(0.5, base));
  return clamp(base + overlay, 0.0, 1.0);
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0; float amplitude = 0.5;
  for (int i = 0; i < 4; i++) { value += amplitude * noise2(p); p = p * 2.02 + 17.13; amplitude *= 0.5; }
  return value;
}
float cellDistance(vec2 p, float randomness) {
  vec2 base = floor(p); vec2 local = fract(p); float distanceToCell = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 offset = vec2(float(x), float(y));
    vec2 point = mix(vec2(0.5), vec2(hash21(base + offset), hash21(base + offset + 19.19)), clamp(randomness, 0.0, 1.0));
    distanceToCell = min(distanceToCell, length(offset + point - local));
  }
  return clamp(distanceToCell * 1.6, 0.0, 1.0);
}
float applyFieldOperations(float value) {
  for (int i = 0; i < 8; i += 2) {
    if (i >= u_field_operation_count) break;
    vec4 op = u_field_operations[i];
    vec4 extra = u_field_operations[i + 1];
    if (op.x < 1.5) {
      float normalized = clamp((value - op.y) / max(0.0001, op.z - op.y), 0.0, 1.0);
      value = op.w + (extra.x - op.w) * pow(normalized, max(0.001, extra.y));
    } else if (op.x < 2.5) {
      float edge = op.y; float softness = max(0.001, op.z);
      value = clamp((value - (edge - softness)) / (softness * 2.0), 0.0, 1.0);
      if (op.w > 0.5) value = 1.0 - value;
    } else if (op.x < 3.5) value = 1.0 - value;
    else if (op.x < 4.5) value = clamp(value, op.y, op.z);
    else if (op.x < 5.5) {
      float normalized = clamp((value - op.y) / max(0.0001, op.z - op.y), 0.0, 1.0);
      value = normalized * normalized * (3.0 - 2.0 * normalized);
    } else if (op.x < 6.5) value += op.y;
    else if (op.x < 7.5) value *= op.y;
    else if (op.x < 8.5) {
      value = value * op.y + op.z;
      if (op.w > 0.0) value = pow(max(0.0, mod(value, op.w)), max(0.001, extra.x));
    }
  }
  return clamp(value, 0.0, 1.0);
}
float applyBlendFieldOperations(float value) {
  for (int i = 0; i < 8; i += 2) {
    if (i >= u_blend_field_operation_count) break;
    vec4 op = u_blend_field_operations[i];
    vec4 extra = u_blend_field_operations[i + 1];
    if (op.x < 1.5) {
      float normalized = clamp((value - op.y) / max(0.0001, op.z - op.y), 0.0, 1.0);
      value = op.w + (extra.x - op.w) * pow(normalized, max(0.001, extra.y));
    } else if (op.x < 2.5) {
      float edge = op.y; float softness = max(0.001, op.z);
      value = clamp((value - (edge - softness)) / (softness * 2.0), 0.0, 1.0);
      if (op.w > 0.5) value = 1.0 - value;
    } else if (op.x < 3.5) value = 1.0 - value;
    else if (op.x < 4.5) value = clamp(value, op.y, op.z);
    else if (op.x < 5.5) {
      float normalized = clamp((value - op.y) / max(0.0001, op.z - op.y), 0.0, 1.0);
      value = normalized * normalized * (3.0 - 2.0 * normalized);
    } else if (op.x < 6.5) value += op.y;
    else if (op.x < 7.5) value *= op.y;
    else if (op.x < 8.5) {
      value = value * op.y + op.z;
      if (op.w > 0.0) value = pow(max(0.0, mod(value, op.w)), max(0.001, extra.x));
    }
  }
  return clamp(value, 0.0, 1.0);
}
float rampPosition(float value, float midpoint) {
  float point = clamp(midpoint, 0.001, 0.999);
  return value < point ? (value / point) * 0.5 : 0.5 + ((value - point) / (1.0 - point)) * 0.5;
}
vec2 aspectCorrectedCenteredUv() {
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  vec2 centeredUv = v_uv - vec2(0.5);
  return aspect >= 1.0 ? centeredUv * vec2(aspect, 1.0) : centeredUv * vec2(1.0, 1.0 / max(aspect, 0.0001));
}
void main() {
  float pulse = 0.96 + sin(u_time * 0.7) * 0.04;
  vec2 centered = aspectCorrectedCenteredUv() - u_gradient_center;
  if (u_displacement.x > 0.0) {
    float displacementField = fbm(centered * max(0.25, u_displacement.y) + vec2(u_time * u_displacement.z));
    float displacementAngle = radians(u_displacement.w);
    centered += vec2(cos(displacementAngle), sin(displacementAngle)) * (displacementField - 0.5) * u_displacement.x;
  }
  float rotation = radians(u_gradient_rotation);
  vec2 rotated = vec2(cos(rotation) * centered.x - sin(rotation) * centered.y, sin(rotation) * centered.x + cos(rotation) * centered.y);
  float gradientPosition = clamp(rotated.y / max(0.05, u_gradient_scale) + 0.5, 0.0, 1.0);
  vec4 color = mix(u_color, u_color_b, gradientPosition * u_gradient);
  float rampValue = gradientPosition;
  float module = u_procedural.x;
  float intensity = u_procedural.y;
  float speed = u_procedural.z;
  float scale = max(0.25, u_procedural.w);
  float direction = radians(u_procedural_options.x);
  float softness = clamp(u_procedural_options.y, 0.05, 1.0);
  float density = clamp(u_procedural_options.z, 0.05, 1.0);
  vec2 flowUv = vec2(cos(direction) * centered.x - sin(direction) * centered.y, sin(direction) * centered.x + cos(direction) * centered.y);
  vec2 fieldUv = flowUv;
  if (u_field_warp.x > 0.0) {
    float warpA = fbm(fieldUv * max(0.25, u_field_warp.y) + vec2(u_time * u_field_warp.z));
    float warpB = fbm(fieldUv * max(0.25, u_field_warp.y) + vec2(13.7, -7.2) - vec2(u_time * u_field_warp.z * 0.7));
    float warpAngle = radians(u_field_warp.w);
    fieldUv += vec2(cos(warpAngle), sin(warpAngle)) * (vec2(warpA, warpB) - 0.5) * u_field_warp.x;
  }
  if (module > 0.5 && module < 1.5) {
    float field = fbm(fieldUv * scale + vec2(u_time * speed, -u_time * speed * 0.7));
    rampValue = field;
    color.rgb = mix(color.rgb, mix(u_color.rgb, u_color_b.rgb, field), intensity * (0.35 + field * 0.65));
  } else if (module > 1.5 && module < 2.5) {
    float ray = abs(fieldUv.x + sin(fieldUv.y * scale + u_time * speed) * 0.18);
    ray = 1.0 - smoothstep(0.02, 0.22 + softness * 0.35, ray);
    rampValue = ray;
    color.rgb += u_color_b.rgb * ray * intensity * density;
  } else if (module > 2.5 && module < 3.5) {
    float field = fbm(fieldUv * scale + u_time * speed * 0.15);
    float lines = abs(fract(field * (4.0 + density * 12.0)) - 0.5);
    float contour = 1.0 - smoothstep(0.02, 0.02 + softness * 0.12, lines);
    rampValue = contour;
    color.rgb = mix(color.rgb, u_color_b.rgb, contour * intensity);
  } else if (module > 3.5 && module < 4.5) {
    vec2 grid = fieldUv * (8.0 + scale * 1.5);
    vec2 baseCellId = floor(grid);
    vec2 cell = fract(grid) - 0.5;
    float emberRandomness = clamp(u_procedural_options.w, 0.0, 1.0);
    float ember = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cellId = baseCellId + vec2(float(x), float(y));
      float positionSeedX = hash21(cellId + vec2(17.13, 4.71));
      float positionSeedY = hash21(cellId + vec2(41.27, 13.91));
      vec2 emberCenter = (vec2(positionSeedX, positionSeedY) - 0.5) * emberRandomness * 0.72;
      float motionPhase = hash21(cellId + vec2(29.17, 67.31)) * 6.28318;
      float motionSpeed = mix(0.65, 1.45, hash21(cellId + vec2(53.27, 11.91)));
      float motionAngle = (hash21(cellId + vec2(83.41, 37.19)) - 0.5) * 6.28318;
      vec2 motionAxis = vec2(cos(motionAngle), sin(motionAngle));
      vec2 crossAxis = vec2(-motionAxis.y, motionAxis.x);
      float motionTime = u_time * speed * motionSpeed + motionPhase;
      emberCenter += motionAxis * sin(motionTime) * 0.18 * emberRandomness;
      emberCenter += crossAxis * cos(motionTime * 0.71 + motionPhase) * 0.08 * emberRandomness;
      float sizeSeed = hash21(cellId + vec2(71.19, 29.43));
      float brightnessSeed = hash21(cellId + vec2(93.17, 51.81));
      float emberSize = 0.105 * mix(1.0, 0.62 + sizeSeed * 0.76, emberRandomness);
      vec2 relative = cell - vec2(float(x), float(y)) - emberCenter;
      float distanceToEmber = length(relative);
      float core = smoothstep(emberSize, 0.0, distanceToEmber);
      float halo = smoothstep(emberSize * (1.8 + softness * 1.8), 0.0, distanceToEmber) * (0.12 + emberRandomness * 0.38);
      float flicker = mix(1.0, 0.72 + 0.5 * sin(u_time * (1.5 + brightnessSeed * 3.0) + brightnessSeed * 6.28318), emberRandomness);
      float gate = step(0.55 - density * 0.4, hash21(cellId + vec2(5.37, 8.19)));
      ember = max(ember, clamp((core + halo) * flicker * gate, 0.0, 1.0));
    }
    rampValue = ember;
    color.rgb += u_color_b.rgb * ember * intensity;
  } else if (module > 4.5 && module < 5.5) {
    float warpA = fbm(fieldUv * scale + vec2(u_time * speed));
    float warpB = fbm(fieldUv * scale + vec2(13.7, -7.2) + vec2(-u_time * speed * 0.7));
    float warped = fbm(fieldUv * scale + (vec2(warpA, warpB) - 0.5) * u_procedural_shape.x * 3.0);
    rampValue = warped;
    color.rgb = mix(color.rgb, mix(u_color.rgb, u_color_b.rgb, warped), 0.85);
  } else if (module > 5.5 && module < 6.5) {
    float distanceFromCenter = length(centered - u_procedural_center);
    float ripple = 0.5 + 0.5 * sin(distanceFromCenter * scale - u_time * speed * 6.0);
    float ring = smoothstep(0.5 - u_procedural_shape.x, 0.5 + u_procedural_shape.x, ripple);
    rampValue = ring;
    color.rgb = mix(color.rgb, mix(u_color.rgb, u_color_b.rgb, ring), 0.9);
  } else if (module > 6.5 && module < 7.5) {
    float cells = 1.0 - cellDistance(fieldUv * scale + vec2(u_time * speed), u_procedural_options.w);
    rampValue = cells;
    color.rgb = mix(color.rgb, mix(u_color.rgb, u_color_b.rgb, cells), 0.9);
  } else if (module > 7.5 && module < 8.5) {
    float stripes = 0.5 + 0.5 * sin(fieldUv.x * scale + u_time * speed * 6.0);
    float band = smoothstep(0.5 - u_procedural_shape.x, 0.5 + u_procedural_shape.x, stripes);
    rampValue = band;
    color.rgb = mix(color.rgb, mix(u_color.rgb, u_color_b.rgb, band), 0.9);
  } else if (module > 8.5 && module < 9.5) {
    vec2 dustGrid = fieldUv * (8.0 + scale * 1.5) + vec2(0.0, u_time * speed);
    vec2 dustCell = fract(dustGrid) - 0.5;
    float sparkle = smoothstep(0.16, 0.0, length(dustCell));
    float sparkleGate = step(0.58 - density * 0.45, hash21(floor(dustGrid)));
    rampValue = sparkle * sparkleGate;
    color.rgb = mix(color.rgb, u_color_b.rgb, sparkle * sparkleGate * intensity);
  } else if (module > 9.5 && module < 10.5) {
    float coordinate = u_procedural_shape.y < 0.5 ? centered.x : u_procedural_shape.y < 1.5 ? centered.y : length(centered);
    float coordinateValue = clamp(coordinate * scale + 0.5, 0.0, 1.0);
    rampValue = coordinateValue;
    color.rgb = mix(color.rgb, mix(u_color.rgb, u_color_b.rgb, coordinateValue), 0.9);
  } else if (module > 10.5 && module < 11.5) {
    float loop = u_procedural_center.y;
    float temporal = u_time * speed + u_procedural_center.x;
    rampValue = loop > 0.0 ? fract(temporal / loop) : fract(temporal);
  }
  rampValue = applyFieldOperations(rampValue);
  if (u_scalar_preview > 0.5) color = vec4(vec3(clamp(rampValue, 0.0, 1.0)), 1.0);
  else if (u_ramp > 0.5) color.rgb = mix(u_color.rgb, u_color_b.rgb, rampPosition(rampValue, u_ramp_midpoint));
  if (u_pattern.x > 0.5) {
    float patternRotation = radians(u_pattern_rotation);
    vec2 patternRotated = vec2(cos(patternRotation) * centered.x - sin(patternRotation) * centered.y, sin(patternRotation) * centered.x + cos(patternRotation) * centered.y);
    vec2 p = patternRotated * max(1.0, u_pattern.y);
    float patternValue = 0.0;
    if (u_pattern.x < 1.5) patternValue = step(1.0 - u_pattern.z, fract(p.x)) * step(1.0 - u_pattern.z, fract(p.y));
    else if (u_pattern.x < 2.5) patternValue = step(1.0 - u_pattern.z, fract(p.y));
    else { vec2 cell = fract(p) - 0.5; patternValue = step(0.25, dot(cell, cell)); }
    patternValue = smoothstep(0.5 - u_pattern.w, 0.5 + u_pattern.w, patternValue);
    color = mix(u_pattern_color, u_color_b, patternValue);
  }
  color.rgb = hueRotate(color.rgb, radians(u_adjust.x));
  float colorLuma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(colorLuma), color.rgb, u_adjust.y);
  color.rgb = clamp(color.rgb * u_brightness, 0.0, 1.0);
  color.rgb = clamp((color.rgb - 0.5) * u_adjust.z + 0.5, 0.0, 1.0);
  float glowLuma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float glowMask = smoothstep(u_glow.x, u_glow.x + max(0.001, u_glow.z), glowLuma);
  color.rgb += u_glow_color.rgb * glowMask * u_glow.y;
  if (u_chromatic.x > 0.0) {
    vec2 chromaticUv = aspectCorrectedCenteredUv();
    float chromaticShift = sin((chromaticUv.x + chromaticUv.y) * 40.0 + u_chromatic.y) * u_chromatic.x;
    color.r = clamp(color.r + chromaticShift, 0.0, 1.0);
    color.b = clamp(color.b - chromaticShift, 0.0, 1.0);
  }
  if (u_grain.x > 0.0) {
    float grainValue = hash21(aspectCorrectedCenteredUv() * max(1.0, u_grain.y) + vec2(u_grain.z, u_time * 0.25)) - 0.5;
    color.rgb = clamp(color.rgb + grainValue * u_grain.x, 0.0, 1.0);
  }
  vec3 blendOverlay = u_blend_color.rgb;
  vec2 blendCentered = aspectCorrectedCenteredUv() - u_blend_gradient_center;
  float blendRotation = radians(u_blend_gradient_rotation);
  vec2 blendRotated = vec2(cos(blendRotation) * blendCentered.x - sin(blendRotation) * blendCentered.y, sin(blendRotation) * blendCentered.x + cos(blendRotation) * blendCentered.y);
  if (u_blend_gradient > 0.5) {
    float blendPosition = clamp(blendRotated.y / max(0.05, u_blend_gradient_scale) + 0.5, 0.0, 1.0);
    blendOverlay = mix(u_blend_color.rgb, u_blend_color_b.rgb, blendPosition);
  }
  float blendModule = u_blend_procedural.x;
  float blendIntensity = u_blend_procedural.y;
  float blendSpeed = u_blend_procedural.z;
  float blendScale = max(0.25, u_blend_procedural.w);
  float blendRampValue = 0.5;
  float blendDirection = radians(u_blend_procedural_options.x);
  float blendSoftness = clamp(u_blend_procedural_options.y, 0.05, 1.0);
  float blendDensity = clamp(u_blend_procedural_options.z, 0.05, 1.0);
  vec2 blendFlowUv = vec2(cos(blendDirection) * blendCentered.x - sin(blendDirection) * blendCentered.y, sin(blendDirection) * blendCentered.x + cos(blendDirection) * blendCentered.y);
  vec2 blendFieldUv = blendFlowUv;
  if (u_blend_field_warp.x > 0.0) {
    float warpA = fbm(blendFieldUv * max(0.25, u_blend_field_warp.y) + vec2(u_time * u_blend_field_warp.z));
    float warpB = fbm(blendFieldUv * max(0.25, u_blend_field_warp.y) + vec2(13.7, -7.2) - vec2(u_time * u_blend_field_warp.z * 0.7));
    float warpAngle = radians(u_blend_field_warp.w);
    blendFieldUv += vec2(cos(warpAngle), sin(warpAngle)) * (vec2(warpA, warpB) - 0.5) * u_blend_field_warp.x;
  }
  if (blendModule > 0.5 && blendModule < 1.5) {
    float field = fbm(blendFieldUv * blendScale + vec2(u_time * blendSpeed, -u_time * blendSpeed * 0.7));
    blendRampValue = field;
    blendOverlay = mix(blendOverlay, mix(u_blend_color.rgb, u_blend_color_b.rgb, field), blendIntensity * (0.35 + field * 0.65));
  } else if (blendModule > 1.5 && blendModule < 2.5) {
    float ray = abs(blendFieldUv.x + sin(blendFieldUv.y * blendScale + u_time * blendSpeed) * 0.18);
    ray = 1.0 - smoothstep(0.02, 0.22 + blendSoftness * 0.35, ray);
    blendRampValue = ray;
    blendOverlay += u_blend_color_b.rgb * ray * blendIntensity * blendDensity;
  } else if (blendModule > 2.5 && blendModule < 3.5) {
    float field = fbm(blendFieldUv * blendScale + u_time * blendSpeed * 0.15);
    float lines = abs(fract(field * (4.0 + blendDensity * 12.0)) - 0.5);
    float contour = 1.0 - smoothstep(0.02, 0.02 + blendSoftness * 0.12, lines);
    blendRampValue = contour;
    blendOverlay = mix(blendOverlay, u_blend_color_b.rgb, contour * blendIntensity);
  } else if (blendModule > 3.5 && blendModule < 4.5) {
    vec2 grid = blendFieldUv * (8.0 + blendScale * 1.5);
    vec2 baseCellId = floor(grid);
    vec2 cell = fract(grid) - 0.5;
    float emberRandomness = clamp(u_blend_procedural_options.w, 0.0, 1.0);
    float ember = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cellId = baseCellId + vec2(float(x), float(y));
      float positionSeedX = hash21(cellId + vec2(17.13, 4.71));
      float positionSeedY = hash21(cellId + vec2(41.27, 13.91));
      vec2 emberCenter = (vec2(positionSeedX, positionSeedY) - 0.5) * emberRandomness * 0.72;
      float motionPhase = hash21(cellId + vec2(29.17, 67.31)) * 6.28318;
      float motionSpeed = mix(0.65, 1.45, hash21(cellId + vec2(53.27, 11.91)));
      float motionAngle = (hash21(cellId + vec2(83.41, 37.19)) - 0.5) * 6.28318;
      vec2 motionAxis = vec2(cos(motionAngle), sin(motionAngle));
      vec2 crossAxis = vec2(-motionAxis.y, motionAxis.x);
      float motionTime = u_time * blendSpeed * motionSpeed + motionPhase;
      emberCenter += motionAxis * sin(motionTime) * 0.18 * emberRandomness;
      emberCenter += crossAxis * cos(motionTime * 0.71 + motionPhase) * 0.08 * emberRandomness;
      float sizeSeed = hash21(cellId + vec2(71.19, 29.43));
      float brightnessSeed = hash21(cellId + vec2(93.17, 51.81));
      float emberSize = 0.105 * mix(1.0, 0.62 + sizeSeed * 0.76, emberRandomness);
      vec2 relative = cell - vec2(float(x), float(y)) - emberCenter;
      float distanceToEmber = length(relative);
      float core = smoothstep(emberSize, 0.0, distanceToEmber);
      float halo = smoothstep(emberSize * (1.8 + blendSoftness * 1.8), 0.0, distanceToEmber) * (0.12 + emberRandomness * 0.38);
      float flicker = mix(1.0, 0.72 + 0.5 * sin(u_time * (1.5 + brightnessSeed * 3.0) + brightnessSeed * 6.28318), emberRandomness);
      float gate = step(0.55 - blendDensity * 0.4, hash21(cellId + vec2(5.37, 8.19)));
      ember = max(ember, clamp((core + halo) * flicker * gate, 0.0, 1.0));
    }
    blendRampValue = ember;
    blendOverlay += u_blend_color_b.rgb * ember * blendIntensity;
  } else if (blendModule > 4.5 && blendModule < 5.5) {
    float warpA = fbm(blendFieldUv * blendScale + vec2(u_time * blendSpeed));
    float warpB = fbm(blendFieldUv * blendScale + vec2(13.7, -7.2) + vec2(-u_time * blendSpeed * 0.7));
    float warped = fbm(blendFieldUv * blendScale + (vec2(warpA, warpB) - 0.5) * u_blend_procedural_shape.x * 3.0);
    blendRampValue = warped;
    blendOverlay = mix(blendOverlay, mix(u_blend_color.rgb, u_blend_color_b.rgb, warped), 0.85);
  } else if (blendModule > 5.5 && blendModule < 6.5) {
    float distanceFromCenter = length(blendCentered);
    float ripple = 0.5 + 0.5 * sin(distanceFromCenter * blendScale - u_time * blendSpeed * 6.0);
    float ring = smoothstep(0.5 - u_blend_procedural_shape.x, 0.5 + u_blend_procedural_shape.x, ripple);
    blendRampValue = ring;
    blendOverlay = mix(blendOverlay, mix(u_blend_color.rgb, u_blend_color_b.rgb, ring), 0.9);
  } else if (blendModule > 6.5 && blendModule < 7.5) {
    float cells = 1.0 - cellDistance(blendFieldUv * blendScale + vec2(u_time * blendSpeed), u_blend_procedural_options.w);
    blendRampValue = cells;
    blendOverlay = mix(blendOverlay, mix(u_blend_color.rgb, u_blend_color_b.rgb, cells), 0.9);
  } else if (blendModule > 7.5 && blendModule < 8.5) {
    float stripes = 0.5 + 0.5 * sin(blendFieldUv.x * blendScale + u_time * blendSpeed * 6.0);
    float band = smoothstep(0.5 - u_blend_procedural_shape.x, 0.5 + u_blend_procedural_shape.x, stripes);
    blendRampValue = band;
    blendOverlay = mix(blendOverlay, mix(u_blend_color.rgb, u_blend_color_b.rgb, band), 0.9);
  } else if (blendModule > 8.5 && blendModule < 9.5) {
    vec2 dustGrid = blendFieldUv * (8.0 + blendScale * 1.5) + vec2(0.0, u_time * blendSpeed);
    vec2 dustCell = fract(dustGrid) - 0.5;
    float sparkle = smoothstep(0.16, 0.0, length(dustCell));
    float sparkleGate = step(0.58 - blendDensity * 0.45, hash21(floor(dustGrid)));
    blendRampValue = sparkle * sparkleGate;
    blendOverlay = mix(blendOverlay, u_blend_color_b.rgb, sparkle * sparkleGate * blendIntensity);
  } else if (blendModule > 9.5 && blendModule < 10.5) {
    float coordinate = u_blend_procedural_shape.y < 0.5 ? blendCentered.x : u_blend_procedural_shape.y < 1.5 ? blendCentered.y : length(blendCentered);
    float coordinateValue = clamp(coordinate * blendScale + 0.5, 0.0, 1.0);
    blendRampValue = coordinateValue;
    blendOverlay = mix(blendOverlay, mix(u_blend_color.rgb, u_blend_color_b.rgb, coordinateValue), 0.9);
  }
  blendRampValue = applyBlendFieldOperations(blendRampValue);
  if (u_blend_ramp > 0.5) blendOverlay = mix(u_blend_color.rgb, u_blend_color_b.rgb, rampPosition(blendRampValue, u_blend_ramp_midpoint));
  if (u_blend_pattern.x > 0.5) {
    float blendPatternRotation = radians(u_blend_pattern_rotation);
    vec2 blendPatternRotated = vec2(cos(blendPatternRotation) * blendCentered.x - sin(blendPatternRotation) * blendCentered.y, sin(blendPatternRotation) * blendCentered.x + cos(blendPatternRotation) * blendCentered.y);
    vec2 p = blendPatternRotated * max(1.0, u_blend_pattern.y);
    float patternValue = 0.0;
    if (u_blend_pattern.x < 1.5) patternValue = step(1.0 - u_blend_pattern.z, fract(p.x)) * step(1.0 - u_blend_pattern.z, fract(p.y));
    else if (u_blend_pattern.x < 2.5) patternValue = step(1.0 - u_blend_pattern.z, fract(p.y));
    else { vec2 cell = fract(p) - 0.5; patternValue = step(0.25, dot(cell, cell)); }
    patternValue = smoothstep(0.5 - u_blend_pattern.w, 0.5 + u_blend_pattern.w, patternValue);
    blendOverlay = mix(u_blend_pattern_color.rgb, u_blend_color_b.rgb, patternValue);
  }
  blendOverlay = hueRotate(blendOverlay, radians(u_blend_adjust.x));
  float blendLuma = dot(blendOverlay, vec3(0.299, 0.587, 0.114));
  blendOverlay = mix(vec3(blendLuma), blendOverlay, u_blend_adjust.y);
  blendOverlay = clamp(blendOverlay * u_blend_brightness, 0.0, 1.0);
  blendOverlay = clamp((blendOverlay - 0.5) * u_blend_adjust.z + 0.5, 0.0, 1.0);
  float blendGlowLuma = dot(blendOverlay, vec3(0.299, 0.587, 0.114));
  float blendGlowMask = smoothstep(u_blend_glow.x, u_blend_glow.x + max(0.001, u_blend_glow.z), blendGlowLuma);
  blendOverlay += u_blend_glow_color.rgb * blendGlowMask * u_blend_glow.y;
  if (u_blend_chromatic.x > 0.0) {
    vec2 blendChromaticUv = aspectCorrectedCenteredUv();
    float blendChromaticShift = sin((blendChromaticUv.x + blendChromaticUv.y) * 40.0 + u_blend_chromatic.y) * u_blend_chromatic.x;
    blendOverlay.r = clamp(blendOverlay.r + blendChromaticShift, 0.0, 1.0);
    blendOverlay.b = clamp(blendOverlay.b - blendChromaticShift, 0.0, 1.0);
  }
  if (u_blend_grain.x > 0.0) {
    float blendGrainValue = hash21(aspectCorrectedCenteredUv() * max(1.0, u_blend_grain.y) + vec2(u_blend_grain.z, u_time * 0.25)) - 0.5;
    blendOverlay = clamp(blendOverlay + blendGrainValue * u_blend_grain.x, 0.0, 1.0);
  }
  float blendVignette = smoothstep(u_blend_vignette.y, u_blend_vignette.y + max(0.001, u_blend_vignette.z), length(aspectCorrectedCenteredUv()));
  blendOverlay = mix(blendOverlay, u_blend_vignette_color.rgb, blendVignette * u_blend_vignette.x);
  float blendAmount = clamp(u_blend.z * u_blend_adjust.w * mix(1.0, u_blend_mask.x, u_blend_mask.y), 0.0, 1.0);
  color.rgb = mix(color.rgb, blendColor(color.rgb, blendOverlay, u_blend.w), blendAmount);
  float vignette = smoothstep(u_vignette.y, u_vignette.y + max(0.001, u_vignette.z), length(aspectCorrectedCenteredUv()));
  color.rgb = mix(color.rgb, u_vignette_color.rgb, vignette * u_vignette.x);
  color.a *= mix(1.0, u_mask.x, u_mask.y) * u_adjust.w;
  outColor = vec4(color.rgb * pulse, color.a);
}`;

const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const postVertexSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;

const blurFragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
uniform vec2 u_direction;
uniform float u_radius;
out vec4 outColor;
void main() {
  vec2 offset = u_direction * u_texel * max(0.0, u_radius);
  vec4 result = texture(u_source, v_uv) * 0.227027;
  result += texture(u_source, v_uv + offset * 1.384615) * 0.316216;
  result += texture(u_source, v_uv - offset * 1.384615) * 0.316216;
  result += texture(u_source, v_uv + offset * 3.230769) * 0.070270;
  result += texture(u_source, v_uv - offset * 3.230769) * 0.070270;
  outColor = result;
}`;

const compositeFragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_previous;
uniform float u_bloom_amount;
uniform float u_trail_amount;
out vec4 outColor;
void main() {
  vec4 scene = texture(u_scene, v_uv);
  vec4 bloom = texture(u_bloom, v_uv);
  vec4 previous = texture(u_previous, v_uv);
  vec3 color = scene.rgb + bloom.rgb * u_bloom_amount;
  color = mix(color, max(color, previous.rgb), u_trail_amount);
  outColor = vec4(color, scene.a);
}`;

const materialCompositeFragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_base;
uniform sampler2D u_overlay;
uniform float u_amount;
uniform float u_mode;
uniform mat3 u_uv_transform;
out vec4 outColor;
vec3 blendColor(vec3 base, vec3 overlay, float mode) {
  if (mode < 0.5) return overlay;
  if (mode < 1.5) return base * overlay;
  if (mode < 2.5) return 1.0 - (1.0 - base) * (1.0 - overlay);
  if (mode < 3.5) return mix(2.0 * base * overlay, 1.0 - 2.0 * (1.0 - base) * (1.0 - overlay), step(0.5, base));
  return clamp(base + overlay, 0.0, 1.0);
}
void main() {
  vec2 uv = (u_uv_transform * vec3(v_uv, 1.0)).xy;
  vec4 base = texture(u_base, uv);
  vec4 overlay = texture(u_overlay, uv);
  float amount = clamp(u_amount * overlay.a, 0.0, 1.0);
  vec3 color = mix(base.rgb, blendColor(base.rgb, overlay.rgb, u_mode), amount);
  float alpha = base.a + overlay.a * (1.0 - base.a) * clamp(u_amount, 0.0, 1.0);
  outColor = vec4(color, alpha);
}`;

function hexToRgba(hex) {
  const value = String(hex || '#808080').replace('#', '');
  const normalized = value.length === 6 ? `${value}ff` : value.padEnd(8, 'f');
  return [0, 2, 4, 6].map(index => parseInt(normalized.slice(index, index + 2), 16) / 255);
}

function numeric(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}
function proceduralModuleType(module) { return { noise: 1, rays: 2, contours: 3, embers: 4, domainWarp: 5, radial: 6, voronoi: 7, wave: 8, dust: 9, coordinate: 10, time: 11 }[module] || 0; }
function axisType(axis) { return axis === 'y' ? 1 : axis === 'radial' ? 2 : 0; }
function encodeFieldOperations(field) {
  const data = new Float32Array(32);
  const operations = Array.isArray(field?.operations) ? field.operations.slice(0, 4) : [];
  operations.forEach((operation, index) => {
    const offset = index * 8;
    const type = { remap: 1, threshold: 2, invert: 3, clamp: 4, smoothstep: 5, add: 6, multiply: 7, timeRemap: 8 }[operation.type] || 0;
    data[offset] = type;
    if (type === 1) {
      data[offset + 1] = numeric(operation.inputMin);
      data[offset + 2] = numeric(operation.inputMax, 1);
      data[offset + 3] = numeric(operation.outputMin);
      data[offset + 4] = numeric(operation.outputMax, 1);
      data[offset + 5] = numeric(operation.curve, 1);
    } else if (type === 2) {
      data[offset + 1] = numeric(operation.edge, 0.5);
      data[offset + 2] = numeric(operation.softness, 0.08);
      data[offset + 3] = numeric(operation.invert);
    } else if (type === 4) {
      data[offset + 1] = numeric(operation.min);
      data[offset + 2] = numeric(operation.max, 1);
    } else if (type === 5) {
      data[offset + 1] = numeric(operation.edge0, 0.25);
      data[offset + 2] = numeric(operation.edge1, 0.75);
    } else if (type === 6 || type === 7) data[offset + 1] = numeric(operation.amount);
    else if (type === 8) {
      data[offset + 1] = numeric(operation.speed, 1);
      data[offset + 2] = numeric(operation.offset);
      data[offset + 3] = numeric(operation.loop);
      data[offset + 4] = numeric(operation.curve, 1);
    }
  });
  return { data, count: operations.length * 2 };
}

function createProgram(gl, vertex, fragment) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error || 'Shader compilation failed');
    }
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program linking failed');
  return program;
}

function cameraMatrix(camera, aspect) {
  const zoom = Math.max(0.01, Number(camera.zoom) || 1);
  // The default stage coordinate space is the complete extended canvas. A
  // fullscreen unit plane should therefore reach both clip-space edges. An
  // explicit "preserve" fit remains available for geometry that needs world
  // units to retain its aspect ratio.
  if ((camera.fit || 'cover') === 'cover') return new Float32Array([zoom, 0, 0, 0, zoom, 0, 0, 0, 1]);
  const width = aspect >= 1 ? aspect : 1;
  const height = aspect >= 1 ? 1 : 1 / aspect;
  return new Float32Array([zoom / width, 0, 0, 0, zoom / height, 0, 0, 0, 1]);
}

// Compose inverse sampling transforms in graph order, then convert the result
// from aspect-corrected coordinates back to texture coordinates.
function compositeUvMatrix(transforms = [], aspect) {
  let cosine = 1;
  let sine = 0;
  let offsetX = 0;
  let offsetY = 0;
  for (const { x, y, scale, rotation } of transforms) {
    const angle = rotation * Math.PI / 180;
    const inverseScale = 1 / Math.max(0.05, scale);
    const c = Math.cos(angle) * inverseScale;
    const s = Math.sin(angle) * inverseScale;
    [cosine, sine] = [cosine * c - sine * s, sine * c + cosine * s];
    offsetX -= cosine * x - sine * y;
    offsetY -= sine * x + cosine * y;
  }
  const width = Math.max(1, aspect);
  const height = Math.max(1, 1 / aspect);
  return new Float32Array([
    cosine, sine * width / height, 0,
    -sine * height / width, cosine, 0,
    0.5 + (offsetX - 0.5 * (cosine * width - sine * height)) / width,
    0.5 + (offsetY - 0.5 * (sine * width + cosine * height)) / height,
    1,
  ]);
}

function createRenderTarget(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Post-processing framebuffer is incomplete');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer, width, height };
}

function destroyRenderTarget(gl, target) {
  if (!target) return;
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

export class RenderEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!this.gl) throw new Error('WebGL2 is unavailable');
    const gl = this.gl;
    this.program = createProgram(gl, vertexSource, fragmentSource);
    this.blurProgram = createProgram(gl, postVertexSource, blurFragmentSource);
    this.compositeProgram = createProgram(gl, postVertexSource, compositeFragmentSource);
    this.materialCompositeProgram = createProgram(gl, postVertexSource, materialCompositeFragmentSource);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    this.position = gl.getAttribLocation(this.program, 'a_position');
    this.camera = gl.getUniformLocation(this.program, 'u_camera');
    this.positionUniform = gl.getUniformLocation(this.program, 'u_position');
    this.scale = gl.getUniformLocation(this.program, 'u_scale');
    this.color = gl.getUniformLocation(this.program, 'u_color');
    this.colorB = gl.getUniformLocation(this.program, 'u_color_b');
    this.gradient = gl.getUniformLocation(this.program, 'u_gradient');
    this.gradientCenter = gl.getUniformLocation(this.program, 'u_gradient_center');
    this.gradientScale = gl.getUniformLocation(this.program, 'u_gradient_scale');
    this.gradientRotation = gl.getUniformLocation(this.program, 'u_gradient_rotation');
    this.ramp = gl.getUniformLocation(this.program, 'u_ramp');
    this.rampMidpoint = gl.getUniformLocation(this.program, 'u_ramp_midpoint');
    this.scalarPreview = gl.getUniformLocation(this.program, 'u_scalar_preview');
    this.fieldOperations = gl.getUniformLocation(this.program, 'u_field_operations');
    this.fieldOperationCount = gl.getUniformLocation(this.program, 'u_field_operation_count');
    this.time = gl.getUniformLocation(this.program, 'u_time');
    this.adjust = gl.getUniformLocation(this.program, 'u_adjust');
    this.brightness = gl.getUniformLocation(this.program, 'u_brightness');
    this.vignette = gl.getUniformLocation(this.program, 'u_vignette');
    this.vignetteColor = gl.getUniformLocation(this.program, 'u_vignette_color');
    this.pattern = gl.getUniformLocation(this.program, 'u_pattern');
    this.patternColor = gl.getUniformLocation(this.program, 'u_pattern_color');
    this.patternRotation = gl.getUniformLocation(this.program, 'u_pattern_rotation');
    this.resolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.blend = gl.getUniformLocation(this.program, 'u_blend');
    this.blendColor = gl.getUniformLocation(this.program, 'u_blend_color');
    this.blendColorB = gl.getUniformLocation(this.program, 'u_blend_color_b');
    this.blendGradient = gl.getUniformLocation(this.program, 'u_blend_gradient');
    this.blendGradientCenter = gl.getUniformLocation(this.program, 'u_blend_gradient_center');
    this.blendGradientScale = gl.getUniformLocation(this.program, 'u_blend_gradient_scale');
    this.blendGradientRotation = gl.getUniformLocation(this.program, 'u_blend_gradient_rotation');
    this.blendProcedural = gl.getUniformLocation(this.program, 'u_blend_procedural');
    this.blendProceduralOptions = gl.getUniformLocation(this.program, 'u_blend_procedural_options');
    this.blendProceduralShape = gl.getUniformLocation(this.program, 'u_blend_procedural_shape');
    this.blendFieldWarp = gl.getUniformLocation(this.program, 'u_blend_field_warp');
    this.blendRamp = gl.getUniformLocation(this.program, 'u_blend_ramp');
    this.blendRampMidpoint = gl.getUniformLocation(this.program, 'u_blend_ramp_midpoint');
    this.blendFieldOperations = gl.getUniformLocation(this.program, 'u_blend_field_operations');
    this.blendFieldOperationCount = gl.getUniformLocation(this.program, 'u_blend_field_operation_count');
    this.blendPattern = gl.getUniformLocation(this.program, 'u_blend_pattern');
    this.blendPatternColor = gl.getUniformLocation(this.program, 'u_blend_pattern_color');
    this.blendPatternRotation = gl.getUniformLocation(this.program, 'u_blend_pattern_rotation');
    this.blendAdjust = gl.getUniformLocation(this.program, 'u_blend_adjust');
    this.blendBrightness = gl.getUniformLocation(this.program, 'u_blend_brightness');
    this.blendGlow = gl.getUniformLocation(this.program, 'u_blend_glow');
    this.blendGlowColor = gl.getUniformLocation(this.program, 'u_blend_glow_color');
    this.blendChromatic = gl.getUniformLocation(this.program, 'u_blend_chromatic');
    this.blendGrain = gl.getUniformLocation(this.program, 'u_blend_grain');
    this.blendVignette = gl.getUniformLocation(this.program, 'u_blend_vignette');
    this.blendVignetteColor = gl.getUniformLocation(this.program, 'u_blend_vignette_color');
    this.blendMask = gl.getUniformLocation(this.program, 'u_blend_mask');
    this.blendBlur = gl.getUniformLocation(this.program, 'u_blend_blur');
    this.mask = gl.getUniformLocation(this.program, 'u_mask');
    this.blur = gl.getUniformLocation(this.program, 'u_blur');
    this.procedural = gl.getUniformLocation(this.program, 'u_procedural');
    this.proceduralOptions = gl.getUniformLocation(this.program, 'u_procedural_options');
    this.proceduralCenter = gl.getUniformLocation(this.program, 'u_procedural_center');
    this.proceduralShape = gl.getUniformLocation(this.program, 'u_procedural_shape');
    this.fieldWarp = gl.getUniformLocation(this.program, 'u_field_warp');
    this.glow = gl.getUniformLocation(this.program, 'u_glow');
    this.glowColor = gl.getUniformLocation(this.program, 'u_glow_color');
    this.chromatic = gl.getUniformLocation(this.program, 'u_chromatic');
    this.grain = gl.getUniformLocation(this.program, 'u_grain');
    this.displacement = gl.getUniformLocation(this.program, 'u_displacement');
    this.postPosition = gl.getAttribLocation(this.blurProgram, 'a_position');
    this.blurSource = gl.getUniformLocation(this.blurProgram, 'u_source');
    this.blurTexel = gl.getUniformLocation(this.blurProgram, 'u_texel');
    this.blurDirection = gl.getUniformLocation(this.blurProgram, 'u_direction');
    this.blurRadius = gl.getUniformLocation(this.blurProgram, 'u_radius');
    this.compositePosition = gl.getAttribLocation(this.compositeProgram, 'a_position');
    this.compositeScene = gl.getUniformLocation(this.compositeProgram, 'u_scene');
    this.compositeBloom = gl.getUniformLocation(this.compositeProgram, 'u_bloom');
    this.compositePrevious = gl.getUniformLocation(this.compositeProgram, 'u_previous');
    this.compositeBloomAmount = gl.getUniformLocation(this.compositeProgram, 'u_bloom_amount');
    this.compositeTrailAmount = gl.getUniformLocation(this.compositeProgram, 'u_trail_amount');
    this.materialCompositePosition = gl.getAttribLocation(this.materialCompositeProgram, 'a_position');
    this.materialCompositeBase = gl.getUniformLocation(this.materialCompositeProgram, 'u_base');
    this.materialCompositeOverlay = gl.getUniformLocation(this.materialCompositeProgram, 'u_overlay');
    this.materialCompositeAmount = gl.getUniformLocation(this.materialCompositeProgram, 'u_amount');
    this.materialCompositeMode = gl.getUniformLocation(this.materialCompositeProgram, 'u_mode');
    this.materialCompositeUv = gl.getUniformLocation(this.materialCompositeProgram, 'u_uv_transform');
    this.targets = null;
    this.previous = null;
    this.previousReady = false;
    this.compositeTargetCursor = 0;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height || !this.targets) {
      this.canvas.width = width;
      this.canvas.height = height;
      destroyRenderTarget(this.gl, this.targets?.scene);
      destroyRenderTarget(this.gl, this.targets?.blurA);
      destroyRenderTarget(this.gl, this.targets?.blurB);
      (this.targets?.composites || []).forEach(target => destroyRenderTarget(this.gl, target));
      if (this.previous) this.gl.deleteTexture(this.previous);
      this.targets = {
        scene: createRenderTarget(this.gl, width, height),
        blurA: createRenderTarget(this.gl, width, height),
        blurB: createRenderTarget(this.gl, width, height),
        composites: [],
      };
      this.previous = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.previous);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA8, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
      this.previousReady = false;
    }
    this.gl.viewport(0, 0, width, height);
  }

  render(document, time = 0) {
    const gl = this.gl;
    this.resize();
    const post = document.postProcess || {};
    const bloomAmount = Math.max(0, Math.min(1, numeric(post.bloom, 0)));
    const trailAmount = Math.max(0, Math.min(0.9, numeric(post.trails, 0)));
    this.compositeTargetCursor = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.scene.framebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.02, 0.03, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawScene(document, time);

    const blurSettings = (document.layers || [])
      .filter(layer => layer.visible !== false && layer.type === 'geometry')
      .map(layer => layer.material?.effects?.blur || {})
      .reduce((strongest, blur) => {
        const radius = Math.max(0, Math.min(1, numeric(blur.radius, 0)));
        return radius > strongest.radius ? { radius, softness: Math.max(0, Math.min(1, numeric(blur.softness, 0.5))) } : strongest;
      }, { radius: 0, softness: 0.5 });
    let sceneTexture = this.targets.scene.texture;
    if (blurSettings.radius > 0) {
      const blurRadius = blurSettings.radius * (2 + blurSettings.softness * 24);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.blurA.framebuffer);
      this.drawBlur(sceneTexture, [1, 0], blurRadius);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.blurB.framebuffer);
      this.drawBlur(this.targets.blurA.texture, [0, 1], blurRadius);
      sceneTexture = this.targets.blurB.texture;
    }

    let bloomTexture = sceneTexture;
    if (bloomAmount > 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.blurA.framebuffer);
      this.drawBlur(sceneTexture, [1, 0]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.blurB.framebuffer);
      this.drawBlur(this.targets.blurA.texture, [0, 1]);
      bloomTexture = this.targets.blurB.texture;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compositeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.compositePosition);
    gl.vertexAttribPointer(this.compositePosition, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTexture); gl.uniform1i(this.compositeScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomTexture); gl.uniform1i(this.compositeBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.previous || this.targets.scene.texture); gl.uniform1i(this.compositePrevious, 2);
    gl.uniform1f(this.compositeBloomAmount, bloomAmount);
    gl.uniform1f(this.compositeTrailAmount, this.previousReady ? trailAmount : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (this.previous) {
      gl.bindTexture(gl.TEXTURE_2D, this.previous);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.canvas.width, this.canvas.height);
      this.previousReady = true;
    }
  }

  drawBlur(texture, direction, radius = 1) {
    const gl = this.gl;
    gl.useProgram(this.blurProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.postPosition);
    gl.vertexAttribPointer(this.postPosition, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.blurSource, 0);
    gl.uniform2f(this.blurTexel, 1 / this.canvas.width, 1 / this.canvas.height);
    gl.uniform2f(this.blurDirection, direction[0], direction[1]);
    gl.uniform1f(this.blurRadius, Math.max(0, Number(radius) || 0));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawScene(document, time) {
    const gl = this.gl;
    const camera = cameraMatrix(document.camera || {}, this.canvas.width / this.canvas.height);
    for (const layer of document.layers || []) {
      if (layer.visible === false || layer.type !== 'geometry') continue;
      if (layer.material?.composite) {
        this.drawCompositeMaterial(layer.material.composite, document, time, layer);
        continue;
      }
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(this.position);
      gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix3fv(this.camera, false, camera);
      gl.uniform2f(this.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.time, time);
      const position = layer.transform?.position || [0, 0, 0];
      const scale = layer.transform?.scale || [1, 1, 1];
      gl.uniform2f(this.positionUniform, Number(position[0]) || 0, Number(position[1]) || 0);
      gl.uniform2f(this.scale, Number(scale[0]) || 1, Number(scale[1]) || 1);
      gl.uniform4fv(this.color, hexToRgba(layer.material?.color));
      gl.uniform4fv(this.colorB, hexToRgba(layer.material?.colorB || layer.material?.color));
      gl.uniform1f(this.gradient, layer.material?.type === 'gradient' || layer.material?.type === 'procedural' ? 1 : 0);
      const gradient = layer.material?.gradient || {};
      gl.uniform2f(this.gradientCenter, Number(gradient.centerX) || 0, Number(gradient.centerY) || 0);
      gl.uniform1f(this.gradientScale, numeric(gradient.scale, 1));
      gl.uniform1f(this.gradientRotation, numeric(gradient.rotation, numeric(gradient.angle, 0)));
      gl.uniform1f(this.ramp, layer.material?.ramp ? 1 : 0);
      gl.uniform1f(this.rampMidpoint, numeric(layer.material?.rampMidpoint, 0.5));
      gl.uniform1f(this.scalarPreview, layer.material?.scalar ? 1 : 0);
      const fieldOperations = encodeFieldOperations(layer.material?.procedural);
      gl.uniform4fv(this.fieldOperations, fieldOperations.data);
      gl.uniform1i(this.fieldOperationCount, fieldOperations.count);
      const effects = layer.material?.effects || {};
      const adjust = effects.adjust || {};
      gl.uniform4f(this.adjust, numeric(adjust.hue), numeric(adjust.saturation, 1), numeric(adjust.contrast, 1), numeric(adjust.opacity, numeric(layer.material?.opacity, 1)));
      gl.uniform1f(this.brightness, numeric(adjust.brightness, 1));
      const vignette = effects.vignette || {};
      gl.uniform4f(this.vignette, Number(vignette.amount) || 0, Number(vignette.radius) || 0.65, Number(vignette.softness) || 0.35, 0);
      gl.uniform4fv(this.vignetteColor, hexToRgba(vignette.color || '#000000'));
      const pattern = layer.material?.pattern || {};
      const patternType = pattern.pattern === 'stripes' ? 2 : pattern.pattern === 'dots' ? 3 : pattern.pattern === 'grid' ? 1 : 0;
      gl.uniform4f(this.pattern, patternType, Number(pattern.scale) || 1, Number(pattern.thickness) || 0.08, Number(pattern.softness) || 0.04);
      gl.uniform4fv(this.patternColor, hexToRgba(pattern.colorA || layer.material?.color));
      gl.uniform1f(this.patternRotation, numeric(pattern.rotation, 0));
      const blend = effects.blend || {};
      const blendMode = blend.mode === 'multiply' ? 1 : blend.mode === 'screen' ? 2 : blend.mode === 'overlay' ? 3 : blend.mode === 'add' ? 4 : 0;
      const overlayMaterial = blend.material || {};
      const overlayGradient = overlayMaterial.gradient || blend.gradient || {};
      const overlayProcedural = overlayMaterial.procedural || {};
      gl.uniform4f(this.blend, 0, 0, Number(blend.amount) || 0, blendMode);
      gl.uniform4fv(this.blendColor, hexToRgba(overlayMaterial.color || blend.color || layer.material?.colorB));
      gl.uniform4fv(this.blendColorB, hexToRgba(overlayMaterial.colorB || blend.colorB || overlayMaterial.color || blend.color || layer.material?.colorB));
      gl.uniform1f(this.blendGradient, overlayMaterial.type === 'gradient' || overlayMaterial.type === 'procedural' || Boolean(blend.gradient) ? 1 : 0);
      gl.uniform2f(this.blendGradientCenter, Number(overlayGradient.centerX) || Number(overlayProcedural.centerX) || 0, Number(overlayGradient.centerY) || Number(overlayProcedural.centerY) || 0);
      gl.uniform1f(this.blendGradientScale, Number(overlayGradient.scale) || 1);
      gl.uniform1f(this.blendGradientRotation, numeric(overlayGradient.rotation, numeric(overlayGradient.angle, 0)));
      gl.uniform4f(this.blendProcedural, proceduralModuleType(overlayProcedural.module), numeric(overlayProcedural.intensity, numeric(overlayProcedural.amount, 0.35)), numeric(overlayProcedural.speed, 0.15), numeric(overlayProcedural.scale, 2));
      gl.uniform4f(this.blendProceduralOptions, numeric(overlayProcedural.direction, 0), numeric(overlayProcedural.softness, 0.6), numeric(overlayProcedural.density, 0.5), numeric(overlayProcedural.randomness, 0.75));
      gl.uniform2f(this.blendProceduralShape, numeric(overlayProcedural.amount, numeric(overlayProcedural.thickness, 0.2)), axisType(overlayProcedural.axis));
      const blendWarp = overlayProcedural.warp || {};
      gl.uniform4f(this.blendFieldWarp, numeric(blendWarp.amount), numeric(blendWarp.scale, 2.4), numeric(blendWarp.speed, 0.12), numeric(blendWarp.direction));
      gl.uniform1f(this.blendRamp, overlayMaterial.ramp ? 1 : 0);
      gl.uniform1f(this.blendRampMidpoint, numeric(overlayMaterial.rampMidpoint, 0.5));
      const blendFieldOperations = encodeFieldOperations(overlayProcedural);
      gl.uniform4fv(this.blendFieldOperations, blendFieldOperations.data);
      gl.uniform1i(this.blendFieldOperationCount, blendFieldOperations.count);
      const overlayPattern = overlayMaterial.pattern || {};
      const overlayPatternType = overlayPattern.pattern === 'stripes' ? 2 : overlayPattern.pattern === 'dots' ? 3 : overlayPattern.pattern === 'grid' ? 1 : 0;
      gl.uniform4f(this.blendPattern, overlayPatternType, Number(overlayPattern.scale) || 1, Number(overlayPattern.thickness) || 0.08, Number(overlayPattern.softness) || 0.04);
      gl.uniform4fv(this.blendPatternColor, hexToRgba(overlayPattern.colorA || overlayMaterial.color));
      gl.uniform1f(this.blendPatternRotation, numeric(overlayPattern.rotation, 0));
      const overlayEffects = overlayMaterial.effects || {};
      const overlayAdjust = overlayEffects.adjust || {};
      gl.uniform4f(this.blendAdjust, numeric(overlayAdjust.hue), numeric(overlayAdjust.saturation, 1), numeric(overlayAdjust.contrast, 1), numeric(overlayAdjust.opacity, numeric(overlayMaterial.opacity, 1)));
      gl.uniform1f(this.blendBrightness, numeric(overlayAdjust.brightness, 1));
      const overlayGlow = overlayEffects.glow || {};
      gl.uniform4f(this.blendGlow, numeric(overlayGlow.threshold, 0.55), numeric(overlayGlow.intensity, 0), numeric(overlayGlow.radius, 0.35), 0);
      gl.uniform4fv(this.blendGlowColor, hexToRgba(overlayGlow.color || '#ffffff'));
      const overlayChromatic = overlayEffects.chromatic || {};
      gl.uniform2f(this.blendChromatic, numeric(overlayChromatic.amount, 0), numeric(overlayChromatic.direction, 0));
      const overlayGrain = overlayEffects.grain || {};
      gl.uniform4f(this.blendGrain, numeric(overlayGrain.amount, 0), numeric(overlayGrain.scale, 80), numeric(overlayGrain.seed, 1), 0);
      const overlayVignette = overlayEffects.vignette || {};
      gl.uniform4f(this.blendVignette, Number(overlayVignette.amount) || 0, Number(overlayVignette.radius) || 0.65, Number(overlayVignette.softness) || 0.35, 0);
      gl.uniform4fv(this.blendVignetteColor, hexToRgba(overlayVignette.color || '#000000'));
      const overlayMask = overlayEffects.mask || {};
      gl.uniform2f(this.blendMask, numeric(overlayMask.value, 1), numeric(overlayMask.amount, 0));
      const overlayBlur = overlayEffects.blur || {};
      gl.uniform2f(this.blendBlur, numeric(overlayBlur.radius, 0), numeric(overlayBlur.softness, 0));
      const mask = effects.mask || {};
      gl.uniform2f(this.mask, numeric(mask.value, 1), numeric(mask.amount, 0));
      const blur = effects.blur || {};
      gl.uniform2f(this.blur, numeric(blur.radius, 0), numeric(blur.softness, 0));
      const procedural = layer.material?.procedural || {};
      const moduleType = proceduralModuleType(procedural.module);
      gl.uniform4f(this.procedural, moduleType, numeric(procedural.intensity, numeric(procedural.amount, 0.35)), numeric(procedural.speed, 0.15), numeric(procedural.scale, 2));
      gl.uniform4f(this.proceduralOptions, numeric(procedural.direction, 0), numeric(procedural.softness, 0.6), numeric(procedural.density, 0.5), numeric(procedural.randomness, 0.75));
      gl.uniform2f(this.proceduralCenter, numeric(procedural.centerX, numeric(procedural.phase)), numeric(procedural.centerY, numeric(procedural.loop)));
      gl.uniform2f(this.proceduralShape, numeric(procedural.amount, numeric(procedural.thickness, 0.2)), axisType(procedural.axis));
      const fieldWarp = procedural.warp || {};
      gl.uniform4f(this.fieldWarp, numeric(fieldWarp.amount), numeric(fieldWarp.scale, 2.4), numeric(fieldWarp.speed, 0.12), numeric(fieldWarp.direction));
      const glow = effects.glow || {};
      gl.uniform4f(this.glow, numeric(glow.threshold, 0.55), numeric(glow.intensity, 0), numeric(glow.radius, 0.35), 0);
      gl.uniform4fv(this.glowColor, hexToRgba(glow.color || '#ffffff'));
      const chromatic = effects.chromatic || {};
      gl.uniform2f(this.chromatic, numeric(chromatic.amount, 0), numeric(chromatic.direction, 0));
      const grain = effects.grain || {};
      gl.uniform4f(this.grain, numeric(grain.amount, 0), numeric(grain.scale, 80), numeric(grain.seed, 1), 0);
      const displacement = effects.displacement || {};
      gl.uniform4f(this.displacement, numeric(displacement.amount, 0), numeric(displacement.scale, 3), numeric(displacement.speed, 0.12), numeric(displacement.direction, 0));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  acquireCompositeTarget() {
    const index = this.compositeTargetCursor++;
    let target = this.targets.composites[index];
    if (!target) {
      target = createRenderTarget(this.gl, this.canvas.width, this.canvas.height);
      this.targets.composites[index] = target;
    }
    return target;
  }

  drawMaterialToTarget(material, document, time, layer, target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawScene({ ...document, layers: [{ ...layer, material }] }, time);
  }

  drawCompositeMaterial(composite, document, time, layer) {
    if (!composite?.base || !composite?.overlay) return;
    const gl = this.gl;
    const outputFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const baseTarget = this.acquireCompositeTarget();
    const overlayTarget = this.acquireCompositeTarget();
    this.drawMaterialToTarget(composite.base, document, time, layer, baseTarget);
    this.drawMaterialToTarget(composite.overlay, document, time, layer, overlayTarget);
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.materialCompositeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.materialCompositePosition);
    gl.vertexAttribPointer(this.materialCompositePosition, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, baseTarget.texture);
    gl.uniform1i(this.materialCompositeBase, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, overlayTarget.texture);
    gl.uniform1i(this.materialCompositeOverlay, 1);
    gl.uniform1f(this.materialCompositeAmount, numeric(composite.amount, 0.5));
    const mode = composite.mode === 'multiply' ? 1 : composite.mode === 'screen' ? 2 : composite.mode === 'overlay' ? 3 : composite.mode === 'add' ? 4 : 0;
    gl.uniform1f(this.materialCompositeMode, mode);
    gl.uniformMatrix3fv(this.materialCompositeUv, false, compositeUvMatrix(composite.transforms, this.canvas.width / this.canvas.height));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.blurProgram);
    gl.deleteProgram(this.compositeProgram);
    gl.deleteProgram(this.materialCompositeProgram);
    destroyRenderTarget(gl, this.targets?.scene);
    destroyRenderTarget(gl, this.targets?.blurA);
    destroyRenderTarget(gl, this.targets?.blurB);
    (this.targets?.composites || []).forEach(target => destroyRenderTarget(gl, target));
    if (this.previous) gl.deleteTexture(this.previous);
  }
}

