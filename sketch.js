// ================
// GLOBAL VARIABLES
// ================
let splines = [];
let staticShapes = [];
let draggedPoint = null;
let draggedStaticShape = null;
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
let originalImageDimensions = { width: 800, height: 600 }; // Default canvas size
let debugMode = false;
let canvasOffset = { x: 0, y: 0 };
let canvas;

// =========
// SETUP
// =========
function setup() {
  canvas = createCanvas(800, 600);
  canvas.parent('canvas-container');
  pixelDensity(1);

  // *** NEW: Add drag and drop handling for background images ***
  canvas.drop(gotFile);

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

  // Selected spline/shape controls
  const controls = ['FPS', 'Duration', 'Size', 'Type', 'FillColor', 'StrokeColor', 'StrokeWeight', 'Tension'];
  controls.forEach(control => {
    document.getElementById(`selected${control}`).addEventListener('input', updateSelectedItem);
  });

  // *** NEW: Add listeners for drag-over visual feedback ***
  const canvasContainer = document.getElementById('canvas-container');
  
  // When a file is dragged over the canvas container
  canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault(); // This is crucial to allow a drop
    e.stopPropagation();
    canvasContainer.classList.add('dragging-over');
  });

  // When a file leaves the canvas container area
  canvasContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    canvasContainer.classList.remove('dragging-over');
  });

  // When a file is dropped (to remove the style)
  // The actual file handling is done by canvas.drop(gotFile)
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
  // If exporting, show a static progress screen and do nothing else.
  if (isExporting) {
    background(240);
    fill(0);
    noStroke();
    textSize(16);
    text(`Exporting Frame: ${exportProgress + 1} / ${exportTotalFrames}`, 20, 40);
    text('Please wait, this may take a moment...', 20, 70);
    return; // Stop the rest of the draw loop.
  }

  // Normal draw loop
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
    fps: 16,
    duration: 5,
    shapeSize: 10,
    shapeType: 'square',
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWeight: 0.5,
    tension: 0,
  };
  let settings = { ...defaultSettings };

  let sourceItem = selectedSpline || selectedStaticShape;
  if (sourceItem) {
    settings = {
      fps: sourceItem.fps || defaultSettings.fps,
      duration: sourceItem.duration || defaultSettings.duration,
      shapeSize: sourceItem.shapeSize,
      shapeType: sourceItem.shapeType,
      fillColor: sourceItem.fillColor,
      strokeColor: sourceItem.strokeColor,
      strokeWeight: sourceItem.strokeWeight,
      tension: sourceItem.tension || defaultSettings.tension,
    };
  }

  const yOffset = (splines.length % 5) * 40;
  const newSpline = { ...settings, points: [createVector(width * 0.25, height / 2 - 50 + yOffset), createVector(width * 0.75, height / 2 - 50 + yOffset)], startTime: millis() };
  splines.push(newSpline);
  selectSpline(newSpline);
}

// --- MODIFIED: This function now inherits properties from the LAST CREATED SHAPE ---
function addStaticShape() {
  // Define the default properties for a static shape
  const defaultSettings = { 
    shapeSize: 10, 
    shapeType: 'square',    // Default to square
    fillColor: '#ffffff',   // Default to white
    strokeColor: '#000000', // Default to black
    strokeWeight: 1         // Default border width to 1
  };
  let settings = { ...defaultSettings };

  // Check if there are any existing static shapes
  if (staticShapes.length > 0) {
    // If so, use the last created shape as the source for properties
    const sourceItem = staticShapes[staticShapes.length - 1]; 
    settings = {
      shapeSize: sourceItem.shapeSize, 
      shapeType: sourceItem.shapeType, 
      fillColor: sourceItem.fillColor,
      strokeColor: sourceItem.strokeColor, 
      strokeWeight: sourceItem.strokeWeight,
    };
  }
  // If no static shapes exist, the defaultSettings will be used.

  // Create the new shape with the determined settings
  const newShape = { ...settings, pos: createVector(width / 2, height / 2), isStatic: true };
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

  ['FPS', 'Duration', 'Tension'].forEach(id => {
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

  ['FPS', 'Duration', 'Tension'].forEach(id => {
    document.getElementById(`selected${id}`).parentElement.style.display = 'none';
  });

  updateSelectedItemUI();
}

function updateSelectedItemUI() {
    const item = selectedSpline || selectedStaticShape;
    if (!item) return;

    document.getElementById('selectedSize').value = item.shapeSize;
    document.getElementById('selectedType').value = item.shapeType;
    document.getElementById('selectedFillColor').value = item.fillColor;
    document.getElementById('selectedStrokeColor').value = item.strokeColor;
    document.getElementById('selectedStrokeWeight').value = item.strokeWeight;

    if (selectedSpline) {
        document.getElementById('selectedFPS').value = item.fps;
        document.getElementById('selectedDuration').value = item.duration;
        document.getElementById('selectedTension').value = item.tension;
    }
}

function updateSelectedItem() {
  const item = selectedSpline || selectedStaticShape;
  if (!item) return;

  item.shapeSize = parseInt(document.getElementById('selectedSize').value);
  item.shapeType = document.getElementById('selectedType').value;
  item.fillColor = document.getElementById('selectedFillColor').value;
  item.strokeColor = document.getElementById('selectedStrokeColor').value;
  item.strokeWeight = parseFloat(document.getElementById('selectedStrokeWeight').value);
  
  if (selectedSpline) {
    item.fps = parseInt(document.getElementById('selectedFPS').value);
    item.duration = parseFloat(document.getElementById('selectedDuration').value);
    item.tension = parseFloat(document.getElementById('selectedTension').value);
  }
}

function clearAll() {
  splines = [];
  staticShapes = [];
  selectedSpline = null;
  selectedStaticShape = null;
  selectedPoint = null;
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
    drawShape(shape.shapeType, shape.shapeSize);
    pop();
    
    if (shape === selectedStaticShape) {
      noFill();
      stroke(0, 150, 255, 200);
      strokeWeight(3);
      rectMode(CENTER);
      rect(shape.pos.x, shape.pos.y, shape.shapeSize + 15, shape.shapeSize + 15);
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
    drawShape(spline.shapeType, spline.shapeSize);
    pop();
  }
}

function drawShape(type, size) {
  switch (type) {
    case 'circle': ellipse(0, 0, size); break;
    case 'square': rectMode(CENTER); rect(0, 0, size, size); break;
    case 'triangle': triangle(-size / 2, size / 2, size / 2, size / 2, 0, -size / 2); break;
  }
}

function drawDragIndicator() { /* ... */ }

// ==============
// INTERACTION
// ==============
function mousePressed() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  for (let i = staticShapes.length - 1; i >= 0; i--) {
    const shape = staticShapes[i];
    const d = dist(mouseX, mouseY, shape.pos.x, shape.pos.y);
    if (d < shape.shapeSize / 2) {
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

  selectedSpline = null;
  selectedStaticShape = null;
  selectedPoint = null;
}

function mouseDragged() {
  if (draggedStaticShape) {
    draggedStaticShape.pos.x = constrain(mouseX, 0, width);
    draggedStaticShape.pos.y = constrain(mouseY, 0, height);
  } else if (draggedPoint) {
    draggedPoint.x = constrain(mouseX, 0, width);
    draggedPoint.y = constrain(mouseY, 0, height);
  }
}

function mouseReleased() {
  draggedPoint = null;
  draggedStaticShape = null;
}

// ==============================
// POINT & SHAPE MANAGEMENT
// ==============================
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

function addPointToSpline() {
  if (!selectedSpline || selectedSpline.points.length < 2) return;
  let maxSegment = { length: 0, index: 0 };
  for (let i = 0; i < selectedSpline.points.length - 1; i++) {
    const p1 = selectedSpline.points[i];
    const p2 = selectedSpline.points[i + 1];
    const segmentLength = dist(p1.x, p1.y, p2.x, p2.y);
    if (segmentLength > maxSegment.length) {
      maxSegment = { length: segmentLength, index: i };
    }
  }
  const p1 = selectedSpline.points[maxSegment.index];
  const p2 = selectedSpline.points[maxSegment.index + 1];
  const newPoint = createVector((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  selectedSpline.points.splice(maxSegment.index + 1, 0, newPoint);
}


// ==============================
// SPLINE & CANVAS MATH/LOGIC
// ==============================
function getCurrentSplinePosition(spline) {
  const totalTime = spline.duration * 1000;
  const currentTime = (millis() - spline.startTime) % totalTime;
  const progress = currentTime / totalTime;
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

  // --- MODIFIED: More flexible browser support for video export ---
  
  // Array of possible video formats to check, in order of preference.
  const mimeTypes = [
    'video/webm;codecs=vp9', // Preferred for Chrome/Edge
    'video/webm;codecs=vp8', // Good fallback for Firefox
    'video/webm',            // Generic fallback
  ];

  let supportedMimeType = null;
  // Check if MediaRecorder API is available at all.
  if (window.MediaRecorder) {
      // Loop through the list of MIME types.
      for (const mimeType of mimeTypes) {
          // Check if the browser supports the current type.
          if (MediaRecorder.isTypeSupported(mimeType)) {
              supportedMimeType = mimeType; // If it's supported, save it...
              break;                        // ...and stop checking.
          }
      }
  }

  // If after checking all types, none were supported, show an alert.
  if (!supportedMimeType) {
    alert("Video export not supported in this browser. Please try a recent version of Chrome, Edge, or Firefox.");
    return;
  }
  // --- END OF MODIFICATION ---

  if (isExporting) return;

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
  
  // Use the successfully found MIME type to create the MediaRecorder.
  mediaRecorder = new MediaRecorder(exportStream, { mimeType: supportedMimeType, videoBitsPerSecond: 2500000 });
  
  mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
  mediaRecorder.onstop = handleExportFinish;
  mediaRecorder.start();
  isExporting = true;
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
      drawShapeOnCanvas(exportCanvas, shape.shapeType, shape.shapeSize * Math.max(scaleX, scaleY));
      exportCanvas.pop();
  }

  for (const spline of splines) {
    const splineDurationMs = spline.duration * 1000;
    let splineProgress;
    if (exportCurrentTimeMs >= splineDurationMs) {
      splineProgress = 1.0;
    } else {
      splineProgress = exportCurrentTimeMs / splineDurationMs;
    }
    const totalLength = calculateSplineLength(spline);
    const targetDistance = splineProgress * totalLength;
    const pos = getPointAtDistance(spline, targetDistance);
    if (pos) {
      const scaleX = exportCanvas.width / width;
      const scaleY = exportCanvas.height / height;
      const strokeScale = (scaleX + scaleY) / 2;
      exportCanvas.push();
      exportCanvas.fill(spline.fillColor);
      exportCanvas.stroke(spline.strokeColor);
      exportCanvas.strokeWeight(spline.strokeWeight * strokeScale);
      exportCanvas.translate(pos.point.x * scaleX, pos.point.y * scaleY);
      drawShapeOnCanvas(exportCanvas, spline.shapeType, spline.shapeSize * Math.max(scaleX, scaleY));
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
    exportProgress++;
    setTimeout(renderNextFrame, 1000 / exportFPS);
  } else {
    finishExport();
  }
}
  
function drawShapeOnCanvas(canvas, type, size) {
  switch (type) {
    case 'circle': canvas.ellipse(0, 0, size); break;
    case 'square': canvas.rectMode(canvas.CENTER); canvas.rect(0, 0, size, size); break;
    case 'triangle': canvas.triangle(-size/2, size/2, size/2, size/2, 0, -size/2); break;
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
  exportCanvas?.remove();
  exportStream?.getTracks().forEach(track => track.stop());
  exportCanvas = null;
  exportStream = null;
  mediaRecorder = null;
  isExporting = false;
}
