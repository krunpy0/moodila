/**
 * Creates an Image object from a src URL
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

/**
 * Returns a cropped File object based on pixelCrop parameters from react-easy-crop
 * @param {string} imageSrc - Object URL or Base64 string of the image
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop - Crop dimensions
 * @param {string} fileName - Optional file name for generated File
 * @returns {Promise<File>}
 */
export async function getCroppedImg(imageSrc, pixelCrop, fileName = "avatar.jpg") {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context available");
  }

  // Set width and height to crop output dimensions
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw cropped image onto canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Return canvas as File object
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      const file = new File([blob], fileName, { type: "image/jpeg" });
      resolve(file);
    }, "image/jpeg", 0.92);
  });
}
