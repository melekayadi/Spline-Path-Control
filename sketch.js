// ================
// GLOBAL VARIABLES
// ================
let splines = [];
let staticShapes = [];
let draggedPoint = null;
let draggedStaticShape = null;
let draggedSpline = null; 
let dragStartPos = null; 
let backgroundImg = null;
let selectedSpline = null;
let selectedStaticShape = null;
let selectedPoint = null;
let selectedPointIndex = -1;
let selectedSplineIndex = -1;
let isExporting = false;
let exportProgress = 0;
let exportTotalFrames = 0;
let exportFPS = 0;
let exportDuration = 0;
let exportCanvas;
let mediaRecorder;
let recordedChunks = [];
let exportStream = null;
let originalImageDimensions = { width: 1000, height: 562 }; 
let debugMode = false;
let canvasOffset = { x: 0, y: 0 };
let canvas;
let appStartTime;
let loopingPreview = true; 
let loopPreviewButton; 

// DOM elements for the export UI
let exportOverlay, progressBarFill, exportPercentage, exportFrameCount;


// =========
// SETUP
// =========
function setup() {
  canvas = createCanvas(1000, 562); 
  canvas.parent('canvas-container');
  pixelDensity(1);
  appStartTime = millis();

  canvas.drop(gotFile);

  exportOverlay = document.getElementById('export-overlay');
  progressBarFill = document.getElementById('progress-bar-fill');
  exportPercentage = document.getElementById('export-percentage');
  exportFrameCount = document.getElementById('export-frame-count');

  setupEventListeners();
  addNewSpline();
}

function setupEventListeners() {
  document.getElementById('deleteSpline').addEventListener('click', deleteSelectedSpline);
  document.getElementById('exportVideo').addEventListener('click', startExport);
  document.getElementById('cancelExport').addEventListener('click', cancelExport);
  document.getElementById('removePoint').addEventListener('click', removeSelectedItem);
  document.getElementById('newSpline').addEventListener('click', addNewSpline);
  document.getElementById('clearAll').addEventListener('click', clearAll);
  document.getElementById('clearBg').addEventListener('click', () => backgroundImg = null);
  document.getElementById('bgImage').addEventListener('change', handleBgImage);
  document.getElementById('addPoint').addEventListener('click', addPointToSpline);
  document.getElementById('addShape').addEventListener('click', addStaticShape);
  document.getElementById('updateCanvasSize').addEventListener('click', updateCanvasSize);
  document.getElementById('resetCanvasSize').addEventListener('click', resetCanvasSize);
  document.getElementById('cloneItem').addEventListener('click', cloneSelectedItem);
  
  document.getElementById('playOnce').addEventListener('click', playOnce);
  loopPreviewButton = document.getElementById('loopPreview');
  loopPreviewButton.addEventListener('click', toggleLooping);

  const controls = ['StartFrame', 'Duration', 'Type', 'FillColor', 'StrokeColor', 'StrokeWeight', 'Tension', 'Easing'];
  controls.forEach(control => {
    document.getElementById(`selected${control}`).addEventListener('input', updateSelectedItem);
  });
  document.getElementById('selectedSizeX').addEventListener('input', updateSelectedItem);
  document.getElementById('selectedSizeY').addEventListener('input', updateSelectedItem);


  const canvasContainer = document.getElementById('canvas-container');
  
  canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    canvasContainer.classList.add('dragging-over');
  });

  canvasContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    canvasContainer.classList.remove('dragging-over');
  });

  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    canvasContainer.classList.remove('dragging-over');
  });
}

// =========
// DRAW
// =========
function draw() {
  background(240);
  if (backgroundImg) {
    image(backgroundImg, 0, 0, width, height);
  }

  drawAllSplines();
  drawStaticShapes();
  drawMovingShapes();

  if (draggedPoint) {
    drawDragIndicator();
  }

  if (debugMode) {
    // Debug drawing code...
  }
}

// ======================================
// ITEM CREATION AND SELECTION LOGIC
// ======================================

function addNewSpline() {
  const defaultSettings = {
    startFrame: 0,
    duration: 5,
    shapeSizeX: 10, 
    shapeSizeY: 10, 
    shapeType: 'square',
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWeight: 0.5,
    tension: 0,
    easing: 'linear',
  };
  let settings = { ...defaultSettings };

  const yOffset = (splines.length % 10) * 20;
  const newSpline = { ...settings, points: [createVector(width * 0.25, height / 2 - 50 + yOffset), createVector(width * 0.75, height / 2 - 50 + yOffset)] };
  splines.push(newSpline);
  selectSpline(newSpline);
}

function addStaticShape() {
  const defaultSettings = { 
    shapeSizeX: 10, 
    shapeSizeY: 10, 
    shapeType: 'square',
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWeight: 1
  };
  let settings = { ...defaultSettings };

  const xOffset = (staticShapes.length % 5) * 20;
  const yOffset = (staticShapes.length % 5) * 20;

  const newShape = { ...settings, pos: createVector(width / 2 + xOffset, height / 2 + yOffset), isStatic: true };
  staticShapes.push(newShape);
  selectStaticShape(newShape);
}

function deleteSelectedSpline() {
    if (selectedSpline) {
        const index = splines.indexOf(selectedSpline);
        if (index > -1) {
            splines.splice(index, 1);
        }
        selectedSpline = null;
        selectedPoint = null;
        if (splines.length > 0) {
            selectSpline(splines[splines.length - 1]);
        } else {
            document.getElementById('spline-controls').style.display = 'none';
        }
    } else {
        alert("No spline selected to delete.");
    }
}

function selectSpline(spline) {
  selectedSpline = spline;
  selectedStaticShape = null;
  document.getElementById('spline-controls').style.display = 'block';
  document.querySelector('h3').textContent = 'Selected Spline Control';

  ['StartFrame', 'Duration', 'Tension', 'Easing'].forEach(id => {
    document.getElementById(`selected${id}`).parentElement.style.display = 'flex';
  });
  
  updateSelectedItemUI();
}

function selectStaticShape(shape) {
  selectedStaticShape = shape;
  selectedSpline = null;
  selectedPoint = null;
  document.getElementById('spline-controls').style.display = 'block';
  document.querySelector('h3').textContent = 'Selected Shape Control';

  ['StartFrame', 'Duration', 'Tension', 'Easing'].forEach(id => {
    document.getElementById(`selected${id}`).parentElement.style.display = 'none';
  });

  updateSelectedItemUI();
}

function updateSelectedItemUI() {
    const item = selectedSpline || selectedStaticShape;
    if (!item) return;

    document.getElementById('selectedSizeX').value = item.shapeSizeX; 
    document.getElementById('selectedSizeY').value = item.shapeSizeY; 
    document.getElementById('selectedType').value = item.shapeType;
    document.getElementById('selectedFillColor').value = item.fillColor;
    document.getElementById('selectedStrokeColor').value = item.strokeColor;
    document.getElementById('selectedStrokeWeight').value = item.strokeWeight;

    if (selectedSpline) {
        document.getElementById('selectedStartFrame').value = item.startFrame;
        document.getElementById('selectedDuration').value = item.duration;
        document.getElementById('selectedTension').value = item.tension;
        document.getElementById('selectedEasing').value = item.easing;
    }
}

function updateSelectedItem() {
  const item = selectedSpline || selectedStaticShape;
  if (!item) return;

  item.shapeSizeX = parseInt(document.getElementById('selectedSizeX').value); 
  item.shapeSizeY = parseInt(document.getElementById('selectedSizeY').value); 
  item.shapeType = document.getElementById('selectedType').value;
  item.fillColor = document.getElementById('selectedFillColor').value;
  item.strokeColor = document.getElementById('selectedStrokeColor').value;
  item.strokeWeight = parseFloat(document.getElementById('selectedStrokeWeight').value);
  
  if (selectedSpline) {
    item.startFrame = parseInt(document.getElementById('selectedStartFrame').value) || 0;
    item.duration = parseFloat(document.getElementById('selectedDuration').value);
    item.tension = parseFloat(document.getElementById('selectedTension').value);
    item.easing = document.getElementById('selectedEasing').value;
  }
}

function clearAll() {
  splines = [];
  staticShapes = [];
  selectedSpline = null;
  selectedStaticShape = null;
  selectedPoint = null;
  appStartTime = millis();
  document.getElementById('spline-controls').style.display = 'none';
  addNewSpline();
}

// ==============
// DRAWING
// ==============
function drawAllSplines() {
  for (let spline of splines) {
    drawSpline(spline, spline === selectedSpline);
    for (let i = 0; i < spline.points.length; i++) {
      drawDirectionalArrow(spline, i);
    }
  }
}

function drawStaticShapes() {
  for (const shape of staticShapes) {
    fill(shape.fillColor);
    stroke(shape.strokeColor);
    strokeWeight(shape.strokeWeight);
    push();
    translate(shape.pos.x, shape.pos.y);
    drawShape(shape.shapeType, shape.shapeSizeX, shape.shapeSizeY); 
    pop();
    
    if (shape === selectedStaticShape) {
      noFill();
      stroke(0, 150, 255, 200);
      strokeWeight(3);
      rectMode(CENTER);
      rect(shape.pos.x, shape.pos.y, shape.shapeSizeX + 15, shape.shapeSizeY + 15); 
    }
  }
}

function drawSpline(spline, isSelected) {
  if (spline.points.length < 2) return;
  noFill();
  stroke(isSelected ? '#ff0000' : '#4CAF50');
  strokeWeight(isSelected ? 3 : 2);
  beginShape();
  vertex(spline.points[0].x, spline.points[0].y);
  const tension = spline.tension / 6.0;
  for (let i = 0; i < spline.points.length - 1; i++) {
    const p1 = spline.points[i];
    const p2 = spline.points[i + 1];
    const p0 = i > 0 ? spline.points[i - 1] : p1;
    const p3 = i < spline.points.length - 2 ? spline.points[i + 2] : p2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    bezierVertex(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  endShape();
}

function drawDirectionalArrow(spline, pointIndex) {
  if (spline.points.length < 2) return;
  
  const p = spline.points[pointIndex];
  let direction;
  const arrowSize = 12;

  if (spline.points.length >= 2) {
      let t = 0.5;
      let segmentIndex = pointIndex;

      if (pointIndex === 0) {
          t = 0.01;
          segmentIndex = 0;
      } else if (pointIndex === spline.points.length - 1) {
          t = 0.99;
          segmentIndex = pointIndex - 1;
      } else {
          const prev = spline.points[pointIndex-1];
          const next = spline.points[pointIndex+1];
          direction = createVector(next.x - prev.x, next.y - prev.y);
      }
      
      if (!direction) {
           const p1 = getPointOnSegment(spline, segmentIndex, t - 0.01);
           const p2 = getPointOnSegment(spline, segmentIndex, t + 0.01);
           if (p1 && p2) {
              direction = p5.Vector.sub(p2, p1);
           } else {
               direction = createVector(1, 0);
           }
      }
  }

  direction.normalize().mult(arrowSize);
  const isSelected = (selectedPoint === p);
  
  push();
  translate(p.x, p.y);
  rotate(direction.heading());

  if (isSelected) {
    fill(255, 0, 0, 153);
    stroke(200, 0, 0);
  } else {
    fill(0, 150, 255, 153);
    stroke(0, 100, 255);
  }
  
  strokeWeight(1.5);
  beginShape();
  vertex(arrowSize, 0);
  vertex(-arrowSize * 0.6, arrowSize * 0.5);
  vertex(-arrowSize * 0.3, 0);
  vertex(-arrowSize * 0.6, -arrowSize * 0.5);
  endShape(CLOSE);
  pop();
}

function drawMovingShapes() {
  for (let spline of splines) {
    if (spline.points.length < 2) continue;
    const pos = getCurrentSplinePosition(spline);
    if (!pos) continue;
    fill(spline.fillColor);
    stroke(spline.strokeColor);
    strokeWeight(spline.strokeWeight);
    push();
    translate(pos.x, pos.y);
    drawShape(spline.shapeType, spline.shapeSizeX, spline.shapeSizeY); 
    pop();
  }
}

function drawShape(type, sizeX, sizeY) { 
  switch (type) {
    case 'circle': ellipse(0, 0, sizeX, sizeY); break;
    case 'square': rectMode(CENTER); rect(0, 0, sizeX, sizeY); break;
    case 'triangle': triangle(-sizeX / 2, sizeY / 2, sizeX / 2, sizeY / 2, 0, -sizeY / 2); break;
  }
}

function drawDragIndicator() { /* ... */ }

// ==============
// INTERACTION
// ==============
function mousePressed() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  if (isExporting) return; 

  for (let i = staticShapes.length - 1; i >= 0; i--) {
    const shape = staticShapes[i];
    const halfSizeX = shape.shapeSizeX / 2; 
    const halfSizeY = shape.shapeSizeY / 2; 
    if (mouseX > shape.pos.x - halfSizeX && mouseX < shape.pos.x + halfSizeX &&
        mouseY > shape.pos.y - halfSizeY && mouseY < shape.pos.y + halfSizeY) { 
      draggedStaticShape = shape;
      selectStaticShape(shape);
      return;
    }
  }
  
  for (let s = 0; s < splines.length; s++) {
    const spline = splines[s];
    for (let i = 0; i < spline.points.length; i++) {
      const p = spline.points[i];
      const d = dist(mouseX, mouseY, p.x, p.y);
      if (d < 15) { 
        draggedPoint = p;
        selectedPoint = p;
        selectedPointIndex = i;
        selectedSplineIndex = s;
        selectSpline(spline);
        return; 
      }
    }
  }

  for (let i = splines.length - 1; i >= 0; i--) {
      const spline = splines[i];
      if (isMouseOnSpline(spline, 10)) { 
          draggedSpline = spline;
          selectSpline(spline);
          dragStartPos = createVector(mouseX, mouseY);
          return;
      }
  }

  selectedSpline = null;
  selectedStaticShape = null;
  selectedPoint = null;
}

function mouseDragged() {
  if (isExporting) return;
  
  if (draggedStaticShape) {
    draggedStaticShape.pos.x = constrain(mouseX, 0, width);
    draggedStaticShape.pos.y = constrain(mouseY, 0, height);
  } else if (draggedPoint) {
    draggedPoint.x = constrain(mouseX, 0, width);
    draggedPoint.y = constrain(mouseY, 0, height);
  } else if (draggedSpline) { 
    const currentMousePos = createVector(mouseX, mouseY);
    const delta = p5.Vector.sub(currentMousePos, dragStartPos);

    for(let point of draggedSpline.points) {
        point.add(delta);
    }
    
    dragStartPos = currentMousePos;
  }
}

function mouseReleased() {
  draggedPoint = null;
  draggedStaticShape = null;
  draggedSpline = null; 
  dragStartPos = null; 
}

function isMouseOnSpline(spline, tolerance) {
    if (spline.points.length < 2) return false;

    for (let i = 0; i < spline.points.length - 1; i++) {
        for (let t = 0; t <= 1; t += 0.05) { 
            const p = getPointOnSegment(spline, i, t);
            if (p) {
                const d = dist(mouseX, mouseY, p.x, p.y);
                if (d < tolerance) {
                    return true;
                }
            }
        }
    }
    return false;
}


// ==============================
// POINT & SHAPE MANAGEMENT
// ==============================
function cloneSelectedItem() {
  const offset = createVector(20, 20); 

  if (selectedSpline) {
    const original = selectedSpline;
    const newSpline = {
      startFrame: original.startFrame,
      duration: original.duration,
      shapeSizeX: original.shapeSizeX, 
      shapeSizeY: original.shapeSizeY, 
      shapeType: original.shapeType,
      fillColor: original.fillColor,
      strokeColor: original.strokeColor,
      strokeWeight: original.strokeWeight,
      tension: original.tension,
      easing: original.easing,
      points: original.points.map(p => {
        let newX = p.x + offset.x;
        let newY = p.y + offset.y;
        if (newX > width) newX -= (width / 4);
        if (newY > height) newY -= (height / 4);
        return createVector(newX, newY);
      })
    };
    splines.push(newSpline);
    selectSpline(newSpline);

  } else if (selectedStaticShape) {
    const original = selectedStaticShape;
    let newX = original.pos.x + offset.x;
    let newY = original.pos.y + offset.y;
    
    if (newX > width) newX = width - original.shapeSizeX; 
    if (newY > height) newY = height - original.shapeSizeY; 

    const newShape = {
      shapeSizeX: original.shapeSizeX, 
      shapeSizeY: original.shapeSizeY, 
      shapeType: original.shapeType,
      fillColor: original.fillColor,
      strokeColor: original.strokeColor,
      strokeWeight: original.strokeWeight,
      isStatic: true,
      pos: createVector(newX, newY)
    };
    staticShapes.push(newShape);
    selectStaticShape(newShape);
  }
}


function removeSelectedItem() {
  if (selectedStaticShape) {
    const index = staticShapes.indexOf(selectedStaticShape);
    if (index > -1) {
      staticShapes.splice(index, 1);
    }
    selectedStaticShape = null;

    if (splines.length > 0) {
      selectSpline(splines[splines.length - 1]);
    } else if (staticShapes.length > 0) {
      selectStaticShape(staticShapes[staticShapes.length - 1]);
    } else {
      document.getElementById('spline-controls').style.display = 'none';
    }

  } else if (selectedPoint && selectedSpline) {
    if (selectedSpline.points.length > 2) {
      selectedSpline.points.splice(selectedPointIndex, 1);
      selectedPoint = null;
      selectedPointIndex = -1;
    } else {
      alert("A spline must have at least 2 points.");
    }
  }
}

// FIXED: This function has been corrected and improved.
function addPointToSpline() {
  if (!selectedSpline || selectedSpline.points.length < 2) {
    return; // Can't add a point if no spline is selected or it has fewer than 2 points.
  }

  // Find the segment with the greatest curve length.
  let longestSegment = {
    index: -1,
    length: 0
  };

  for (let i = 0; i < selectedSpline.points.length - 1; i++) {
    let segmentLength = 0;
    const steps = 20; // Number of small steps to approximate curve length
    let lastPoint = getPointOnSegment(selectedSpline, i, 0);

    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const currentPoint = getPointOnSegment(selectedSpline, i, t);
      segmentLength += dist(lastPoint.x, lastPoint.y, currentPoint.x, currentPoint.y);
      lastPoint = currentPoint;
    }

    if (segmentLength > longestSegment.length) {
      longestSegment.length = segmentLength;
      longestSegment.index = i;
    }
  }

  if (longestSegment.index !== -1) {
    // Calculate the new point at the halfway mark (t=0.5) of the longest segment.
    const newPoint = getPointOnSegment(selectedSpline, longestSegment.index, 0.5);
    
    // Insert the new point into the array using splice().
    selectedSpline.points.splice(longestSegment.index + 1, 0, newPoint);
  }
}


// ==============================
// PREVIEW CONTROLS
// ==============================

function toggleLooping() {
  loopingPreview = !loopingPreview;
  if (loopingPreview) {
    loopPreviewButton.textContent = 'Loop Preview: ON';
    loopPreviewButton.style.backgroundColor = 'var(--accent-success)';
    appStartTime = millis(); 
  } else {
    loopPreviewButton.textContent = 'Loop Preview: OFF';
    loopPreviewButton.style.backgroundColor = 'var(--accent-danger)';
  }
}

function playOnce() {
  if (loopingPreview) {
    toggleLooping(); 
  }
  appStartTime = millis(); 
}


// ==============================
// SPLINE & CANVAS MATH/LOGIC
// ==============================

function applyEasing(t, easingType) {
  switch (easingType) {
    case 'easeIn': return t * t;
    case 'easeOut': return t * (2 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'linear': default: return t;
  }
}

function getCurrentSplinePosition(spline) {
  const fps = 60;
  const startDelayMs = (spline.startFrame / fps) * 1000;
  const totalTime = spline.duration * 1000;
  const globalElapsedTime = millis() - appStartTime;

  if (globalElapsedTime < startDelayMs) {
    return null;
  }

  let splineLocalTime = globalElapsedTime - startDelayMs;
  let progress;

  if (loopingPreview) {
    const currentTimeInLoop = splineLocalTime % totalTime;
    progress = currentTimeInLoop / totalTime;
  } else {
    progress = constrain(splineLocalTime / totalTime, 0, 1);
  }
  
  progress = applyEasing(progress, spline.easing);

  const targetDistance = progress * calculateSplineLength(spline);
  return getPointAtDistance(spline, targetDistance)?.point;
}

function calculateSplineLength(spline) {
  if (spline.points.length < 2) return 0;
  let totalLength = 0;
  const segments = 100;
  for (let i = 0; i < spline.points.length - 1; i++) {
    let prevPoint = getPointOnSegment(spline, i, 0);
    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const currentPoint = getPointOnSegment(spline, i, t);
      totalLength += dist(prevPoint.x, prevPoint.y, currentPoint.x, currentPoint.y);
      prevPoint = currentPoint;
    }
  }
  return totalLength;
}

function getPointAtDistance(spline, targetDistance) {
    if (spline.points.length < 2) return null;
    let accumulatedDistance = 0;
    const segments = 100;

    if (targetDistance <= 0) return { point: spline.points[0], segmentIndex: 0, t: 0 };
    
    for (let i = 0; i < spline.points.length - 1; i++) {
        let segmentStart = getPointOnSegment(spline, i, 0);
        for (let j = 1; j <= segments; j++) {
            const t = j / segments;
            const segmentEnd = getPointOnSegment(spline, i, t);
            const segmentLength = dist(segmentStart.x, segmentStart.y, segmentEnd.x, segmentEnd.y);
            if (accumulatedDistance + segmentLength >= targetDistance) {
                const ratio = (targetDistance - accumulatedDistance) / segmentLength;
                const point = p5.Vector.lerp(segmentStart, segmentEnd, ratio);
                return { point: point, segmentIndex: i, t: (j - 1 + ratio) / segments };
            }
            accumulatedDistance += segmentLength;
            segmentStart = segmentEnd;
        }
    }
    return { point: spline.points[spline.points.length - 1], segmentIndex: spline.points.length - 2, t: 1 };
}

function getPointOnSegment(spline, segmentIndex, t) {
  if (segmentIndex < 0 || segmentIndex >= spline.points.length - 1) return null;
  const p1 = spline.points[segmentIndex];
  const p2 = spline.points[segmentIndex + 1];
  if (spline.points.length < 3) return p5.Vector.lerp(p1, p2, t);
  const p0 = segmentIndex > 0 ? spline.points[segmentIndex - 1] : p1;
  const p3 = segmentIndex < spline.points.length - 2 ? spline.points[segmentIndex + 2] : p2;
  const tension = spline.tension / 6.0;
  const cp1x = p1.x + (p2.x - p0.x) * tension;
  const cp1y = p1.y + (p2.y - p0.y) * tension;
  const cp2x = p2.x - (p3.x - p1.x) * tension;
  const cp2y = p2.y - (p3.y - p1.y) * tension;
  const x = bezierPoint(p1.x, cp1x, cp2x, p2.x, t);
  const y = bezierPoint(p1.y, cp1y, cp2y, p2.y, t);
  return createVector(x, y);
}

function windowResized() {
  if (backgroundImg) {
    resizeCanvasToFit();
  }
}

function resizeCanvasToFit() {
  let sourceWidth = originalImageDimensions.width;
  let sourceHeight = originalImageDimensions.height;
  const splineControls = document.getElementById('spline-controls');
  const sidebarWidth = splineControls.offsetWidth;
  const horizontalMargin = sidebarWidth + 100;
  const verticalMargin = 250;
  const maxDisplayWidth = window.innerWidth - horizontalMargin;
  const maxDisplayHeight = window.innerHeight - verticalMargin;
  const ratio = Math.min(maxDisplayWidth / sourceWidth, maxDisplayHeight / sourceHeight);
  const displayWidth = sourceWidth * ratio;
  const displayHeight = sourceHeight * ratio;
  if (Math.round(displayWidth) > 0 && Math.round(displayHeight) > 0) {
    document.getElementById('canvasWidth').value = Math.round(displayWidth);
    document.getElementById('canvasHeight').value = Math.round(displayHeight);
    updateCanvasSize();
  }
}

function updateCanvasSize() {
  const newWidth = parseInt(document.getElementById('canvasWidth').value);
  const newHeight = parseInt(document.getElementById('canvasHeight').value);
  if (newWidth !== width || newHeight !== height) {
    const originalWidth = width;
    const originalHeight = height;
    resizeCanvas(newWidth, newHeight);
    for (let spline of splines) {
      for (let point of spline.points) {
        point.x = (point.x / originalWidth) * newWidth;
        point.y = (point.y / originalHeight) * newHeight;
      }
    }
  }
}

function resetCanvasSize() {
  let targetWidth, targetHeight;

  if (backgroundImg) {
    targetWidth = originalImageDimensions.width;
    targetHeight = originalImageDimensions.height;
  } else {
    targetWidth = 1000;
    targetHeight = 562;
  }

  document.getElementById('canvasWidth').value = targetWidth;
  document.getElementById('canvasHeight').value = targetHeight;
  
  updateCanvasSize();
}


function handleBgImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    backgroundImg = loadImage(e.target.result,
      img => {
        originalImageDimensions = { width: img.width, height: img.height };
        resizeCanvasToFit();
      },
      err => console.error('Error loading image:', err)
    );
  };
  reader.readAsDataURL(file);
}

function gotFile(file) {
  if (file.type === 'image') {
    backgroundImg = loadImage(file.data, img => {
      originalImageDimensions = { width: img.width, height: img.height };
      resizeCanvasToFit();
    }, err => {
      console.error('Error loading dropped image:', err);
    });
  } else {
    console.log('Not an image file!');
  }
}
  
// ==============
// EXPORT
// ==============
function startExport() {
  if (splines.length === 0 && staticShapes.length === 0) {
    alert("There is nothing to export.");
    return;
  }

  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  let supportedMimeType = null;
  if (window.MediaRecorder) {
      for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
              supportedMimeType = mimeType;
              break;
          }
      }
  }

  if (!supportedMimeType) {
    alert("Video export not supported in this browser. Please try a recent version of Chrome, Edge, or Firefox.");
    return;
  }

  if (isExporting) return;
  isExporting = true;
  
  exportOverlay.style.display = 'flex';
  progressBarFill.style.width = '0%';
  exportPercentage.textContent = '0%';
  exportFrameCount.textContent = `Frame 0 of ${exportTotalFrames}`;


  exportFPS = parseInt(document.getElementById('exportFPS').value);
  exportDuration = parseFloat(document.getElementById('exportSeconds').value);
  exportTotalFrames = Math.ceil(exportFPS * exportDuration);
  exportProgress = 0;
  recordedChunks = [];
  const exportWidth = backgroundImg ? originalImageDimensions.width : width;
  const exportHeight = backgroundImg ? originalImageDimensions.height : height;
  exportCanvas = createGraphics(exportWidth, exportHeight);
  exportCanvas.pixelDensity(1);
  exportCanvas.hide();
  exportStream = exportCanvas.elt.captureStream(exportFPS);
  
  mediaRecorder = new MediaRecorder(exportStream, { mimeType: supportedMimeType, videoBitsPerSecond: 2500000 });
  
  mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
  mediaRecorder.onstop = handleExportFinish;
  mediaRecorder.start();
  
  renderNextFrame();
}
  
function drawExportFrame(overallProgress) {
  exportCanvas.background(255);
  const exportCurrentTimeMs = overallProgress * exportDuration * 1000;

  for (const shape of staticShapes) {
      const scaleX = exportCanvas.width / width;
      const scaleY = exportCanvas.height / height;
      exportCanvas.push();
      exportCanvas.fill(shape.fillColor);
      exportCanvas.stroke(shape.strokeColor);
      exportCanvas.strokeWeight(shape.strokeWeight * ((scaleX + scaleY) / 2));
      exportCanvas.translate(shape.pos.x * scaleX, shape.pos.y * scaleY);
      drawShapeOnCanvas(exportCanvas, shape.shapeType, shape.shapeSizeX * scaleX, shape.shapeSizeY * scaleY); 
      exportCanvas.pop();
  }

  for (const spline of splines) {
    const startDelayMs = (spline.startFrame / exportFPS) * 1000;

    if (exportCurrentTimeMs < startDelayMs) continue;

    const splineLocalTime = exportCurrentTimeMs - startDelayMs;
    const splineDurationMs = spline.duration * 1000;
    
    let splineProgress = constrain(splineLocalTime / splineDurationMs, 0, 1);
    
    splineProgress = applyEasing(splineProgress, spline.easing);

    const totalLength = calculateSplineLength(spline);
    const targetDistance = splineProgress * totalLength;
    const pos = getPointAtDistance(spline, targetDistance);
    if (pos) {
      const scaleX = exportCanvas.width / width;
      const scaleY = exportCanvas.height / height;
      exportCanvas.push();
      exportCanvas.fill(spline.fillColor);
      exportCanvas.stroke(spline.strokeColor);
      exportCanvas.strokeWeight(spline.strokeWeight * ((scaleX + scaleY) / 2));
      exportCanvas.translate(pos.point.x * scaleX, pos.point.y * scaleY);
      drawShapeOnCanvas(exportCanvas, spline.shapeType, spline.shapeSizeX * scaleX, spline.shapeSizeY * scaleY); 
      exportCanvas.pop();
    }
  }

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.requestData();
  }
}
  
function renderNextFrame() {
  if (!isExporting) return;
  if (exportProgress < exportTotalFrames) {
    drawExportFrame(exportProgress / exportTotalFrames);
    
    const progressPercent = (exportProgress / exportTotalFrames) * 100;
    progressBarFill.style.width = `${progressPercent}%`;
    exportPercentage.textContent = `${Math.round(progressPercent)}%`;
    exportFrameCount.textContent = `Frame ${exportProgress} of ${exportTotalFrames}`;

    exportProgress++;
    setTimeout(renderNextFrame, 1000 / exportFPS);
  } else {
    progressBarFill.style.width = '100%';
    exportPercentage.textContent = '100%';
    exportFrameCount.textContent = `Frame ${exportTotalFrames} of ${exportTotalFrames}`;
    finishExport();
  }
}
  
function drawShapeOnCanvas(canvas, type, sizeX, sizeY) { 
  switch (type) {
    case 'circle': canvas.ellipse(0, 0, sizeX, sizeY); break;
    case 'square': canvas.rectMode(canvas.CENTER); canvas.rect(0, 0, sizeX, sizeY); break;
    case 'triangle': canvas.triangle(-sizeX/2, sizeY/2, sizeX/2, sizeY/2, 0, -sizeY/2); break;
  }
}

function handleExportFinish() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'spline-animation.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
  cleanupExport();
}

function finishExport() {
  if (mediaRecorder?.state !== 'inactive') {
    mediaRecorder.stop();
  } else {
    cleanupExport();
  }
}

function cancelExport() {
  if (isExporting) {
    isExporting = false; 
    if (mediaRecorder?.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }
}

function cleanupExport() {
  if(exportOverlay) {
    exportOverlay.style.display = 'none';
  }

  exportCanvas?.remove();
  exportStream?.getTracks().forEach(track => track.stop());
  exportCanvas = null;
  exportStream = null;
  mediaRecorder = null;
  isExporting = false;
}
