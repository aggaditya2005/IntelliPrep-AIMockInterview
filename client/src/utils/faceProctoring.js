const visionWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const faceModelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function createFaceLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(visionWasmUrl);

  const options = {
    baseOptions: { modelAssetPath: faceModelUrl },
    runningMode: "VIDEO",
    numFaces: 3,
    outputFaceBlendshapes: false,
  };

  try {
    return await FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "GPU" },
    });
  } catch {
    return FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "CPU" },
    });
  }
}

export function getFacePose(landmarks) {
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  if (!nose || !leftEye || !rightEye || !forehead || !chin) return null;

  const eyeWidth = Math.abs(rightEye.x - leftEye.x);
  const faceHeight = Math.abs(chin.y - forehead.y);
  if (eyeWidth < 0.001 || faceHeight < 0.001) return null;

  const leftInnerEye = landmarks[133];
  const rightInnerEye = landmarks[362];
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const leftUpperLid = landmarks[159];
  const leftLowerLid = landmarks[145];
  const rightUpperLid = landmarks[386];
  const rightLowerLid = landmarks[374];
  const horizontalGaze = leftInnerEye && rightInnerEye && leftIris && rightIris
    ? (
      (leftIris.x - Math.min(leftEye.x, leftInnerEye.x)) / Math.abs(leftInnerEye.x - leftEye.x) +
      (rightIris.x - Math.min(rightInnerEye.x, rightEye.x)) / Math.abs(rightEye.x - rightInnerEye.x)
    ) / 2
    : null;
  const verticalGaze = leftUpperLid && leftLowerLid && rightUpperLid && rightLowerLid && leftIris && rightIris
    ? (
      (leftIris.y - Math.min(leftUpperLid.y, leftLowerLid.y)) / Math.abs(leftLowerLid.y - leftUpperLid.y) +
      (rightIris.y - Math.min(rightUpperLid.y, rightLowerLid.y)) / Math.abs(rightLowerLid.y - rightUpperLid.y)
    ) / 2
    : null;

  return {
    horizontal: (nose.x - (leftEye.x + rightEye.x) / 2) / eyeWidth,
    vertical: (nose.y - (leftEye.y + rightEye.y) / 2) / faceHeight,
    horizontalGaze: Number.isFinite(horizontalGaze) ? horizontalGaze : null,
    verticalGaze: Number.isFinite(verticalGaze) ? verticalGaze : null,
  };
}

export function averageFacePose(poses) {
  const average = (key) => {
    const values = poses.map((pose) => pose[key]).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  return {
    horizontal: average("horizontal"),
    vertical: average("vertical"),
    horizontalGaze: average("horizontalGaze"),
    verticalGaze: average("verticalGaze"),
  };
}

export function getGazeDirectionAlert(pose, baseline) {
  if (
    Math.abs(pose.horizontal - baseline.horizontal) > 0.24 ||
    (pose.horizontalGaze !== null && baseline.horizontalGaze !== null &&
      Math.abs(pose.horizontalGaze - baseline.horizontalGaze) > 0.18)
  ) {
    return "looking-sideways";
  }

  if (
    pose.vertical - baseline.vertical > 0.09 ||
    (pose.verticalGaze !== null && baseline.verticalGaze !== null &&
      pose.verticalGaze - baseline.verticalGaze > 0.18)
  ) {
    return "looking-down";
  }

  return null;
}
