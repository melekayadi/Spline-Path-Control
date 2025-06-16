// ================
// GLOBAL VARIABLES
// ================
let splines = [];
let draggedPoint = null;
let backgroundImg = null;
let selectedSpline = null;
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
let exportStream = null; // <--- ADD THIS LINE
let originalImageDimensions = { width: 800, height: 600 }; // Default canvas size
let debugMode = false;
let canvasOffset = { x: 0, y: 0 };
let canvas;

// =========
// SETUP
// =========
function setup() {
  // Create canvas with fixed pixel dimensions
  canvas = createCanvas(800, 600);
  canvas.parent('canvas-container');
  
  // Ensure no CSS scaling interferes
  canvas.elt.style.width = '800px';
  canvas.elt.style.height = '600px';
  
  pixelDensity(1);
  setupEventListeners();
  addNewSpline();
}

function setupEventListeners() {
  
  document.getElementById('deleteSpline').addEventListener('click', deleteSelectedSpline);
  document.getElementById('exportVideo').addEventListener('click', startExport);
  document.getElementById('cancelExport').addEventListener('click', cancelExport);
  document.getElementById('removePoint').addEventListener('click', removeSelectedPoint);
  document.getElementById('newSpline').addEventListener('click', addNewSpline);
  document.getElementById('clearAll').addEventListener('click', clearAllSplines);
  document.getElementById('clearBg').addEventListener('click', () => backgroundImg = null);
  document.getElementById('bgImage').addEventListener('change', handleBgImage);
  document.getElementById('addPoint').addEventListener('click', addPointToSpline);
  document.getElementById('updateCanvasSize').addEventListener('click', updateCanvasSize);
  
  // Selected spline controls
  const controls = ['FPS', 'Duration', 'Size', 'Type', 'FillColor', 'StrokeColor', 'StrokeWeight', 'Tension'];
  controls.forEach(control => {
    document.getElementById(`selected${control}`).addEventListener('input', updateSelectedSpline);
  });
}

// =========
// DRAW
// =========
// =========
// DRAW
// =========
// =========
// DRAW
// =========
function draw() {
  // If we are exporting, just show a static progress screen and do nothing else.
  // The export now happens asynchronously in the background.
  if (isExporting) {
    background(240);
    fill(0);
    noStroke();
    textSize(16);
    // Use exportProgress + 1 so it shows "1 / 150" instead of "0 / 150" at the start
    text(`Exporting Frame: ${exportProgress + 1} / ${exportTotalFrames}`, 20, 40);
    text('Please wait, this may take a moment...', 20, 70);
    return; // IMPORTANT: This command stops the rest of the draw loop from running.
  }

  // This is the normal draw loop for when you are NOT exporting
  background(240);
  
  if (backgroundImg) {
    image(backgroundImg, 0, 0, width, height);
  }
  
  drawAllSplines();
  drawMovingShapes();
  
  if (draggedPoint) {
    drawDragIndicator();
  }
  
  if (debugMode) {
    fill(255, 0, 0);
    noStroke();
    textSize(12);
    text(`p5 Mouse: ${mouseX.toFixed(1)}, ${mouseY.toFixed(1)}`, 10, 20);

    const scaledMouse = getCanvasMouse();
    text(`Scaled: ${scaledMouse.x.toFixed(1)}, ${scaledMouse.y.toFixed(1)}`, 10, 40);

    for (let s = 0; s < splines.length; s++) {
      const spline = splines[s];
      for (let i = 0; i < spline.points.length; i++) {
        const p = spline.points[i];
        const isSelected = (selectedPoint === p);
        fill(isSelected ? color(255, 0, 0, 150) : color(0, 255, 0, 150));
        ellipse(p.x, p.y, 20, 20);
        fill(0);
        text(`${s}-${i}`, p.x + 15, p.y + 5);
      }
    }
  }
}

// ==============
// SPLINE LOGIC
// ==============
function addNewSpline() {
  // Define default settings, used only for the very first spline
  // or after the canvas has been cleared.
  const defaultSettings = {
    fps: 16,
    duration: 5,
    shapeSize: 30,
    shapeType: 'square',
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWeight: 1,
    tension: 0,
  };

  // Start by assuming we'll use the default settings.
  let settings = { ...defaultSettings };

  // If a spline is already selected, override the defaults
  // with the settings from that selected spline.
  if (selectedSpline) {
    settings = {
      fps: selectedSpline.fps,
      duration: selectedSpline.duration,
      shapeSize: selectedSpline.shapeSize,
      shapeType: selectedSpline.shapeType,
      fillColor: selectedSpline.fillColor,
      strokeColor: selectedSpline.strokeColor,
      strokeWeight: selectedSpline.strokeWeight,
      tension: selectedSpline.tension,
    };
  }
  
  // Add a small vertical offset for new splines to prevent them from
  // being created directly on top of each other.
  const yOffset = (splines.length % 5) * 40;

  const newSpline = {
    // Use the determined settings (either inherited or default)
    ...settings,
    
    // But always give the new spline its own unique position and start time
    points: [
      createVector(width * 0.25, height / 2 - 50 + yOffset),
      createVector(width * 0.75, height / 2 - 50 + yOffset)
    ],
    startTime: millis()
  };

  splines.push(newSpline);
  selectSpline(newSpline); // Automatically select the new spline
}
function deleteSelectedSpline() {
  if (selectedSplineIndex >= 0) {
    // Remove the selected spline
    splines.splice(selectedSplineIndex, 1);
    
    // Reset selection variables
    selectedSpline = null;
    selectedPoint = null;
    selectedPointIndex = -1;
    selectedSplineIndex = -1;
    
    // Hide the spline controls if no splines left
    if (splines.length === 0) {
      document.getElementById('spline-controls').style.display = 'none';
      // Optionally create a new spline automatically
      addNewSpline();
    } else {
      // Select the last spline if available
      selectSpline(splines[splines.length - 1]);
    }
  } else {
    alert("No spline selected. Click on a spline point to select it first.");
  }
}

function selectSpline(spline) {
  selectedSpline = spline;
  document.getElementById('spline-controls').style.display = 'block';
  
  // Update control values
  document.getElementById('selectedFPS').value = spline.fps;
  document.getElementById('selectedDuration').value = spline.duration;
  document.getElementById('selectedSize').value = spline.shapeSize;
  document.getElementById('selectedType').value = spline.shapeType;
  document.getElementById('selectedFillColor').value = spline.fillColor;
  document.getElementById('selectedStrokeColor').value = spline.strokeColor;
  document.getElementById('selectedStrokeWeight').value = spline.strokeWeight;
  document.getElementById('selectedTension').value = spline.tension;
}

function updateSelectedSpline() {
  if (!selectedSpline) return;
  
  selectedSpline.fps = parseInt(document.getElementById('selectedFPS').value);
  selectedSpline.duration = parseFloat(document.getElementById('selectedDuration').value);
  selectedSpline.shapeSize = parseInt(document.getElementById('selectedSize').value);
  selectedSpline.shapeType = document.getElementById('selectedType').value;
  selectedSpline.fillColor = document.getElementById('selectedFillColor').value;
  selectedSpline.strokeColor = document.getElementById('selectedStrokeColor').value;
  selectedSpline.strokeWeight = parseInt(document.getElementById('selectedStrokeWeight').value);
  selectedSpline.tension = parseFloat(document.getElementById('selectedTension').value);
}

function clearAllSplines() {
  splines = [];
  selectedSpline = null;
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

function drawSpline(spline, isSelected) {
  if (spline.points.length < 2) return;

  noFill();
  stroke(isSelected ? '#ff0000' : '#000000');
  strokeWeight(isSelected ? 3 : 2);
  
  beginShape();
  vertex(spline.points[0].x, spline.points[0].y);

  // A tension value of 1.0 is very high for this algorithm, 
  // so we scale it down. A divisor of 6 is standard.
  const tension = spline.tension / 6.0;

  // Iterate through each segment of the spline
  for (let i = 0; i < spline.points.length - 1; i++) {
    // For the segment between p1 and p2, we need the points before (p0) and after (p3)
    const p1 = spline.points[i];
    const p2 = spline.points[i + 1];
    
    // If the surrounding points don't exist, use the nearest end point.
    // This makes the curve start and end straight.
    const p0 = i > 0 ? spline.points[i - 1] : p1;
    const p3 = i < spline.points.length - 2 ? spline.points[i + 2] : p2;

    // Calculate the two Bézier control points for this segment
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    // Draw the cubic Bézier curve segment
    bezierVertex(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  endShape();
}

function drawDirectionalArrow(spline, pointIndex) {
  if (spline.points.length < 2) return;
  
  const p = spline.points[pointIndex];
  let direction;
  const arrowSize = 20;

  if (pointIndex === 0) {
    direction = createVector(spline.points[1].x - p.x, spline.points[1].y - p.y);
  } else if (pointIndex === spline.points.length - 1) {
    direction = createVector(p.x - spline.points[pointIndex-1].x, p.y - spline.points[pointIndex-1].y);
  } else {
    const prev = spline.points[pointIndex-1];
    const next = spline.points[pointIndex+1];
    direction = createVector((next.x - prev.x) * 0.5, (next.y - prev.y) * 0.5);
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
    case 'circle':
      ellipse(0, 0, size);
      break;
    case 'square':
      rectMode(CENTER);
      rect(0, 0, size, size);
      break;
    case 'triangle':
      triangle(
        -size/2, size/2,
        size/2, size/2,
        0, -size/2
      );
      break;
  }
}

function drawDragIndicator() {
  if(debugMode){
     fill(255, 0, 0);
  noStroke();
  text("Dragging point", 10, 20);
  }
 
}

function resizeCanvasToFit() {
  // Determine the source dimensions to maintain aspect ratio from.
  // This uses the background image's original dimensions if it exists.
  let sourceWidth = originalImageDimensions.width;
  let sourceHeight = originalImageDimensions.height;

  // 1. Get the sidebar element to measure its actual width on screen.
  const splineControls = document.getElementById('spline-controls');
  const sidebarWidth = splineControls.offsetWidth;

  // 2. Define total fixed horizontal and vertical space used by UI elements.
  const horizontalMargin = sidebarWidth + 100;
  const verticalMargin = 250;

  // 3. Calculate the true maximum available area for the canvas.
  const maxDisplayWidth = window.innerWidth - horizontalMargin;
  const maxDisplayHeight = window.innerHeight - verticalMargin;

  // 4. Calculate the scaling ratio needed to fit the source dimensions into the available area.
  const ratio = Math.min(maxDisplayWidth / sourceWidth, maxDisplayHeight / sourceHeight);
  
  // 5. Calculate the new display size. We removed the "if (ratio < 1.0)" check
  //    so the canvas will now scale UP as well as down to always fit the available space.
  const displayWidth = sourceWidth * ratio;
  const displayHeight = sourceHeight * ratio;

  // 6. Update the canvas size inputs and apply the changes.
  if (Math.round(displayWidth) > 0 && Math.round(displayHeight) > 0) {
    document.getElementById('canvasWidth').value = Math.round(displayWidth);
    document.getElementById('canvasHeight').value = Math.round(displayHeight);
    updateCanvasSize();
    
    document.getElementById('resetCanvasSize').addEventListener('click', resetCanvasSize);
  }
}

function resetCanvasSize() {
  // Check if a background image exists
  if (backgroundImg) {
    // If it does, resizeCanvasToFit will automatically use its original dimensions
    // because they are already stored in the originalImageDimensions global variable.
    resizeCanvasToFit();
  } else {
    // If there's no image, we first set the global originalImageDimensions
    // to our default size of 800x600.
    originalImageDimensions = { width: 800, height: 600 };
    // Then, we call resizeCanvasToFit, which will now use this default size
    // to calculate the best fit for the current window.
    resizeCanvasToFit();
  }
}

// ==============
// INTERACTION
// ==============
function mousePressed() {
  // No need to get canvas mouse here if we trust p5's mouseX/Y in this instance
  // The problem is more likely in the interaction between CSS and the canvas element.
  // Let's ensure the event is inside the canvas before doing anything.

  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    for (let s = 0; s < splines.length; s++) {
      const spline = splines[s];
      for (let i = 0; i < spline.points.length; i++) {
        const p = spline.points[i];
        
        // Use p5's built-in mouseX and mouseY which are relative to the canvas
        const d = dist(mouseX, mouseY, p.x, p.y);
        
        if (debugMode) {
            console.log(`Checking point ${s}-${i} at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) against mouse (${mouseX.toFixed(2)}, ${mouseY.toFixed(2)}) - distance: ${d.toFixed(2)}`);
        }
        
        if (d < 15) { // Increased hit radius slightly for easier clicking
          draggedPoint = p;
          selectedPoint = p;
          selectedSplineIndex = s;
          selectedPointIndex = i;
          selectSpline(spline);
          return; // Exit after finding a point
        }
      }
    }
  }
}

function mouseDragged() {
  if (draggedPoint) {
    // Directly use p5's mouseX and mouseY
    draggedPoint.x = mouseX;
    draggedPoint.y = mouseY;

    // Constrain the point to stay within the canvas boundaries
    draggedPoint.x = constrain(draggedPoint.x, 0, width);
    draggedPoint.y = constrain(draggedPoint.y, 0, height);
  }
}

function mouseReleased() {
  draggedPoint = null;
}

function getCanvasMouse() {
  // The canvas element from p5.js
  const canvasEl = canvas.elt;
  
  // Its position and size on the page
  const rect = canvasEl.getBoundingClientRect();
  
  // p5.js's mouseX and mouseY are relative to the canvas.
  // We just need to make sure we're using them directly.
  // The issue often comes from CSS scaling, which we can correct.
  
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // The mouse position relative to the viewport is in the global mouseX, mouseY
  // but p5's mouseX/Y should be relative to canvas. Let's use the most direct approach.
  const mx = (mouseX - rect.left) * scaleX;
  const my = (mouseY - rect.top) * scaleY;

  return createVector(
    constrain(mx, 0, width),
    constrain(my, 0, height)
  );
}

// ==============
// POINT MANAGEMENT
// ==============
function removeSelectedPoint() {
  if (selectedSplineIndex >= 0 && selectedPointIndex >= 0) {
    const spline = splines[selectedSplineIndex];
    if (spline.points.length > 2) {
      spline.points.splice(selectedPointIndex, 1);
      selectedPoint = null;
      selectedPointIndex = -1;
    } else {
      alert("A spline must have at least 2 points");
    }
  }
}

function addPointToSpline() {
  if (!selectedSpline || selectedSpline.points.length < 2) return;
  
  let maxSegment = { length: 0, index: 0 };
  
  for (let i = 0; i < selectedSpline.points.length - 1; i++) {
    const p1 = selectedSpline.points[i];
    const p2 = selectedSpline.points[i+1];
    const segmentLength = dist(p1.x, p1.y, p2.x, p2.y);
    
    if (segmentLength > maxSegment.length) {
      maxSegment = { length: segmentLength, index: i };
    }
  }
  
  const p1 = selectedSpline.points[maxSegment.index];
  const p2 = selectedSpline.points[maxSegment.index+1];
  const newPoint = createVector((p1.x + p2.x)/2, (p1.y + p2.y)/2);
  
  selectedSpline.points.splice(maxSegment.index+1, 0, newPoint);
}

// ==============
// SPLINE MATH
// ==============
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
  
  for (let i = 0; i < spline.points.length - 1; i++) {
    let segmentStart = getPointOnSegment(spline, i, 0);
    
    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const segmentEnd = getPointOnSegment(spline, i, t);
      const segmentLength = dist(segmentStart.x, segmentStart.y, segmentEnd.x, segmentEnd.y);
      
      if (accumulatedDistance + segmentLength >= targetDistance) {
        const ratio = (targetDistance - accumulatedDistance) / segmentLength;
        return {
          point: createVector(
            lerp(segmentStart.x, segmentEnd.x, ratio),
            lerp(segmentStart.y, segmentEnd.y, ratio)
          ),
          segmentIndex: i,
          t: t
        };
      }
      
      accumulatedDistance += segmentLength;
      segmentStart = segmentEnd;
    }
  }
  
  return {
    point: spline.points[spline.points.length - 1],
    segmentIndex: spline.points.length - 2,
    t: 1
  };
}

function getPointOnSegment(spline, segmentIndex, t) {
  if (segmentIndex < 0 || segmentIndex >= spline.points.length - 1) return null;

  const p1 = spline.points[segmentIndex];
  const p2 = spline.points[segmentIndex + 1];

  // Handle a simple straight line if there are only two points in the whole spline
  if (spline.points.length < 3) {
    return p5.Vector.lerp(p1, p2, t);
  }

  // Use the same logic as drawSpline to find the surrounding points
  const p0 = segmentIndex > 0 ? spline.points[segmentIndex - 1] : p1;
  const p3 = segmentIndex < spline.points.length - 2 ? spline.points[segmentIndex + 2] : p2;

  const tension = spline.tension / 6.0;

  // Calculate the exact same control points as drawSpline
  const cp1x = p1.x + (p2.x - p0.x) * tension;
  const cp1y = p1.y + (p2.y - p0.y) * tension;
  const cp2x = p2.x - (p3.x - p1.x) * tension;
  const cp2y = p2.y - (p3.y - p1.y) * tension;

  // Now, use p5.js's bezierPoint() function to find the precise X and Y
  // on the curve defined by our anchors (p1, p2) and control points (cp1, cp2).
  const x = bezierPoint(p1.x, cp1x, cp2x, p2.x, t);
  const y = bezierPoint(p1.y, cp1y, cp2y, p2.y, t);

  return createVector(x, y);
}

function isPointNearSpline(x, y, spline, threshold = 10) {
  if (spline.points.length < 2) return false;
  
  for (let i = 0; i < spline.points.length - 1; i++) {
    const p0 = spline.points[i];
    const p1 = spline.points[i + 1];
    if (distToSegment(x, y, p0.x, p0.y, p1.x, p1.y) < threshold) {
      return true;
    }
  }
  return false;
}

function distToSegment(x, y, x1, y1, x2, y2) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  
  if (len_sq !== 0) param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return dist(x, y, xx, yy);
}

// ==============
// CANVAS RESIZING
// ==============
function updateCanvasSize() {
  const newWidth = parseInt(document.getElementById('canvasWidth').value);
  const newHeight = parseInt(document.getElementById('canvasHeight').value);

  if (newWidth !== width || newHeight !== height) {
    const originalWidth = width;
    const originalHeight = height;

    // This correctly resizes the canvas's internal resolution (its drawing buffer).
    resizeCanvas(newWidth, newHeight);

    // --- DELETE THESE TWO LINES ---
    // This was forcing a fixed pixel size on the container, causing the overflow.
    // Our new CSS now handles the visual size automatically.
    // canvasContainer.style.width = `${newWidth}px`;
    // canvasContainer.style.height = `${newHeight}px`;
    // ---------------------------------

    // Scale all points proportionally (this is still correct)
    for (let spline of splines) {
      for (let point of spline.points) {
        point.x = (point.x / originalWidth) * newWidth;
        point.y = (point.y / originalHeight) * newHeight;
      }
    }

    // We no longer need to resize the p5.Image object.
    // The `image()` call in draw() will draw it to the new canvas size correctly.
    /* if (backgroundImg) {
       backgroundImg.resize(newWidth, newHeight); 
    }
    */
  }
}
  
  function windowResized() {
  // If a background image is loaded, resize the canvas to fit the new window size.
  if (backgroundImg) {
    resizeCanvasToFit();
  }
}

function handleBgImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    backgroundImg = loadImage(e.target.result,
      img => {
        // First, save the image's true original dimensions.
        originalImageDimensions = { width: img.width, height: img.height };
        
        // Now, just call our new reusable function to handle the resizing.
        resizeCanvasToFit();
      },
      err => console.error('Error loading image:', err)
    );
  };
  reader.readAsDataURL(file);
}

// ==============
// EXPORT
// ==============
function startExport() {
  if (splines.length === 0) {
    alert("There is nothing to export.");
    return;
  }
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    alert("Video export not supported in this browser.");
    return;
  }
  if (isExporting) return;

  // Assign values to our GLOBAL export variables
  exportFPS = parseInt(document.getElementById('exportFPS').value);
  exportDuration = parseFloat(document.getElementById('exportSeconds').value); // Assign to global

  exportTotalFrames = Math.ceil(exportFPS * exportDuration);
  exportProgress = 0;
  recordedChunks = [];

  const exportWidth = backgroundImg ? originalImageDimensions.width : width;
  const exportHeight = backgroundImg ? originalImageDimensions.height : height;

  exportCanvas = createGraphics(exportWidth, exportHeight);
  exportCanvas.pixelDensity(1);
  exportCanvas.hide();

  exportStream = exportCanvas.elt.captureStream(exportFPS);

  mediaRecorder = new MediaRecorder(exportStream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2500000
  });

  mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
  mediaRecorder.onstop = handleExportFinish;
  mediaRecorder.start();

  isExporting = true;

  renderNextExportFrame();
}
  
  
function drawExportFrame(overallProgress) {
  // 1. Clear the hidden export canvas.
  exportCanvas.background(255);

  // 2. Calculate the current time in the export video (in milliseconds).
  const exportCurrentTimeMs = overallProgress * exportDuration * 1000;

  // 3. Loop through all splines.
  for (const spline of splines) {
    const splineDurationMs = spline.duration * 1000;
    let splineProgress; // Declare progress variable

    // --- THIS IS THE KEY CHANGE ---
    // 4. Check if the current export time is past this spline's individual duration.
    if (exportCurrentTimeMs >= splineDurationMs) {
      // If it is, the animation for this spline is DONE.
      // Clamp its progress to 1.0 to keep it at its final position.
      splineProgress = 1.0;
    } else {
      // If the animation is still playing, calculate its progress normally.
      splineProgress = exportCurrentTimeMs / splineDurationMs;
    }
    // --- END OF CHANGE ---

    // 5. Find the spline's position on its path using its calculated progress.
    const totalLength = calculateSplineLength(spline);
    const targetDistance = splineProgress * totalLength;
    const pos = getPointAtDistance(spline, targetDistance);

    // 6. If the position is valid, draw that spline's shape.
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

  // 7. Tell the recorder to capture the completed frame.
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.requestData();
  }
}
  
function renderNextExportFrame() {
  if (!isExporting) {
    return;
  }

  if (exportProgress < exportTotalFrames) {
    drawExportFrame(exportProgress / exportTotalFrames);
    exportProgress++;

    // THIS IS THE FIX:
    // We now wait the correct amount of time between frames.
    setTimeout(renderNextExportFrame, 1000 / exportFPS);
  } else {
    finishExport();
  }
}
  
function drawShapeOnCanvas(canvas, type, size) {
  switch (type) {
    case 'circle':
      canvas.ellipse(0, 0, size);
      break;
    case 'square':
      canvas.rectMode(canvas.CENTER);
      canvas.rect(0, 0, size, size);
      break;
    case 'triangle':
      canvas.triangle(
        -size/2, size/2,
        size/2, size/2,
        0, -size/2
      );
      break;
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
    // This will stop the renderNextExportFrame loop.
    isExporting = false; 

    if (mediaRecorder?.state !== 'inactive') {
      mediaRecorder.stop();
    }
    // Let the onstop handler do the rest of the cleanup.
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
