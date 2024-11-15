// src/app/stepper/stepper.component.ts
import * as exifr from 'exifr';

import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

// Angular Material Modules
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatStepper } from '@angular/material/stepper';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

// ngx-filepond Modules
import { FilePondComponent, FilePondModule } from 'ngx-filepond';
import { registerPlugin } from 'ngx-filepond';

// FilePond Plugins
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';

// Register FilePond plugins
registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateType);

// ZXing for barcode decoding
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  Result,
} from '@zxing/library';

// Import ngx-image-cropper
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [
    CommonModule,
    MatStepperModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    FilePondModule,
    ReactiveFormsModule,
    ImageCropperComponent, // Ensure this is imported
  ],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.css'],
})
export class StepperComponent implements OnInit {
  //Mobile responsivity

  isMobile: boolean = false;
  hasCamera: boolean = false;

  frontForm: FormGroup;
  backForm: FormGroup;
  frontImage: File | null = null;
  backImage: File | undefined = undefined;
  frontImagePreview: string | ArrayBuffer | null = null;
  backImagePreview: string | ArrayBuffer | null = null;
  originalBackImagePreview: string | ArrayBuffer | null = null; // Store original back image

  needsCropping: boolean = false; // Controls whether the cropping step is displayed

  licenseData: any = null;
  isProcessing: boolean = false;
  errorMessage: string | null = null;
  @ViewChild('stepper') stepper!: MatStepper;

  // Cropping properties
  croppedBackImage: string = '';
  croppedBackImageBlob: Blob | null = null; // To store the cropped image blob
  isCropping: boolean = false; // Manage cropping state

  @ViewChild('backPond') backPondComponent!: FilePondComponent; // Reference to FilePond

  // FilePond Files Arrays
  backFiles: any[] = []; // For back image files
  frontFiles: File[] = []; // For front image files

  // Upscaling attempts
  upscaleAttempt: number = 0;
  maxUpscaleAttempts: number = 3; // Allow up to 3 attempts

  // Processing states
  isBackImageProcessing: boolean = false;

  isCroppedImageAvailable: boolean = false;
  isCroppedImageProcessing: boolean = false;
  isCroppingToolReady: boolean = false;

  // Upscaling dimensions
  upscaleWidth: number = 1920; // Initial upscale width
  upscaleHeight: number = 1920; // Initial upscale height

  // FilePond Options
  frontPondOptions: any = {
    allowImageCrop: false,
    acceptedFileTypes: ['image/jpeg', 'image/png'],
    maxFileSize: '100MB',
    allowMultiple: false,
    labelIdle:
      'Drag & Drop your front license or <span class="filepond--label-action">Browse</span>',
  };

  backPondOptions: any = {
    allowImageCrop: false,
    acceptedFileTypes: ['image/jpeg', 'image/png'],
    maxFileSize: '100MB',
    allowMultiple: false,
    labelIdle:
      'Drag & Drop your back license or <span class="filepond--label-action">Browse</span>',
  };

  constructor(private fb: FormBuilder) {
    this.frontForm = this.fb.group({
      frontImage: [null, Validators.required],
    });
    this.backForm = this.fb.group({
      backImage: [null, Validators.required],
    });

    // Check if device is mobile
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // Check if device has camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => (this.hasCamera = true))
        .catch(() => (this.hasCamera = false));
    }
  }

  ngOnInit(): void {
    if (this.isMobile) {
      this.frontPondOptions = {
        ...this.frontPondOptions,
        stylePanelAspectRatio: 0.75, // Portrait orientation
        imagePreviewHeight: 160,
        labelIdle: 'Tap to upload front of license',
      };

      this.backPondOptions = {
        ...this.backPondOptions,
        stylePanelAspectRatio: 0.75,
        imagePreviewHeight: 160,
        labelIdle: 'Tap to upload back of license',
      };
    }
  }

  async captureImage(type: 'front' | 'back'): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `${type}-license.jpg`, {
            type: 'image/jpeg',
          });
          if (type === 'front') {
            this.onFrontImageAdded({ file: { file } });
          } else {
            this.onBackImageAdded({ file: { file } });
          }
        }
      }, 'image/jpeg');

      // Stop camera stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error('Camera error:', error);
      alert('Failed to access camera. Please try uploading an image instead.');
    }
  }

  /**
   * Handles the addition of a front image file.
   * @param event The event emitted when a front image is added.
   */
  onFrontImageAdded(event: any) {
    const file: File = event.file.file;
    if (this.validateImage(file)) {
      this.frontImage = file;
      this.frontForm.patchValue({ frontImage: file });

      // Update frontFiles array
      this.frontFiles = [file];

      const reader = new FileReader();
      reader.onload = () => {
        this.frontImagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      alert(
        'Invalid front image. Please upload a valid JPEG or PNG image under 100MB.'
      );
      event.file.rejectFile();
    }
  }

  /**
   * Handles the addition of a back image file.
   * Sets up the image and its preview but does not process it yet.
   */
  onBackImageAdded(event: any) {
    const file: File = event.file.file;
    if (this.validateImage(file)) {
      this.backImage = file;
      this.backForm.patchValue({ backImage: file });

      // Update backFiles array
      this.backFiles = [file];

      const reader = new FileReader();
      reader.onload = () => {
        this.backImagePreview = reader.result;
        this.originalBackImagePreview = this.backImagePreview; // Store original
        this.isBackImageProcessing = false;
        this.errorMessage = null;
        this.upscaleAttempt = 0; // Reset attempts on new image
      };
      reader.readAsDataURL(file);
    } else {
      alert(
        'Invalid back image. Please upload a valid JPEG or PNG image under 100MB.'
      );
      event.file.rejectFile();
    }
  }

  /**
   * Processes the back image when the user clicks 'Next' after uploading back image.
   */
  async processBackImage() {
    if (!this.backImagePreview) {
      alert('Please upload the back image first.');
      return;
    }
    this.isProcessing = true;
    this.isBackImageProcessing = true;
    this.errorMessage = null;

    try {
      // Try to read barcode without upscaling
      const barcodeText = await this.extractBarcodeData(
        this.backImagePreview as string
      );
      this.licenseData = this.parseBarcodeData(barcodeText);
      this.isProcessing = false;
      this.isBackImageProcessing = false;
      console.log('License Data:', this.licenseData);
      // Proceed to final step
      this.stepper.selectedIndex = 4; // Adjust index based on your steps
    } catch (error) {
      console.warn(
        'Initial barcode extraction failed. Attempting upscaling...'
      );
      try {
        // Upscale the image once and try again
        await this.upscaleBackImage();
        const barcodeText = await this.extractBarcodeData(
          this.backImagePreview as string
        );
        this.licenseData = this.parseBarcodeData(barcodeText);
        this.isProcessing = false;
        this.isBackImageProcessing = false;

        console.log('License Data in catch section:', this.licenseData);
        // Proceed to final step
        this.stepper.selectedIndex = 3; // Adjust index based on your steps
      } catch (error) {
        // If still fails, proceed to cropping step without alerting the user
        console.error('Barcode extraction failed after upscaling:', error);
        this.isProcessing = false;
        this.isBackImageProcessing = false;
        this.needsCropping = true;
        // Do not start cropping automatically
        this.stepper.selectedIndex = 2; // Move to cropping step
      }
    }
  }

  /**
   * Upscales the back image and updates the preview using the provided upscaling logic.
   */
  async upscaleBackImage() {
    if (!this.originalBackImagePreview) return;

    // Set upscale dimensions to maximum desired values
    this.upscaleWidth = 3000;
    this.upscaleHeight = 3000;

    const upscaledImage = await this.upscaleImage(
      this.originalBackImagePreview as string,
      this.upscaleWidth,
      this.upscaleHeight
    );

    // Update backImage and backImagePreview with upscaled image
    this.backImage = this.base64ToFile(
      upscaledImage,
      'upscaled-back-image.png'
    );
    this.backImagePreview = upscaledImage;

    // Update the backFiles array with the upscaled file
    this.backFiles = [this.backImage];
  }

  /**
   * Handles the removal of the front image.
   * Clears the preview and resets the form control.
   */
  onFrontImageRemoved(event: any) {
    // Clear the front image properties
    this.frontImage = null;
    this.frontImagePreview = null;

    // Clear the frontFiles array
    this.frontFiles = [];

    // Reset the front form control
    this.frontForm.patchValue({ frontImage: null });
  }

  /**
   * Handles the removal of the back image.
   * Clears the preview and resets the form control.
   */
  onBackImageRemoved(event: any) {
    // Clear the back image properties
    this.backImage = undefined;
    this.backImagePreview = null;
    this.originalBackImagePreview = null;

    // Clear the backFiles array
    this.backFiles = [];

    // Reset the back form control
    this.backForm.patchValue({ backImage: null });

    // If cropping was active, cancel it
    if (this.isCropping) {
      this.cancelCropping();
    }

    // Reset needsCropping flag
    this.needsCropping = false;

    // Reset upscale attempts
    this.upscaleAttempt = 0;

    // Reset processing states
    this.isBackImageProcessing = false;
    this.errorMessage = null;

    // Reset upscale dimensions
    this.upscaleWidth = 1920;
    this.upscaleHeight = 1920;
  }

  /**
   * Handles the 'Next' button click on the 'Upload Back Image' step.
   */
  onBackImageNext() {
    this.processBackImage();
  }

  // Start Cropping
  async startCropping() {
    this.isCropping = true;
    this.isCroppingToolReady = false;

    // Set upscale dimensions to maximum desired values
    this.upscaleWidth = 3000;
    this.upscaleHeight = 3000;

    // Upscale the back image before opening the cropping tool
    await this.upscaleBackImage();
  }

  // Cancel Cropping
  cancelCropping() {
    this.isCropping = false;
    this.croppedBackImage = '';
    this.croppedBackImageBlob = null;

    // Reset processing states
    this.isCroppedImageAvailable = false;
    this.isCroppedImageProcessing = false;
    this.upscaleAttempt = 0;
    this.errorMessage = null;

    // Reset upscale dimensions
    this.upscaleWidth = 1920;
    this.upscaleHeight = 1920;
  }

  /**
   * Handles the image loaded event from the image cropper.
   */
  onImageLoaded() {
    this.isCroppingToolReady = true;
  }

  /**
   * Handles the image cropped event from the image cropper.
   * @param event The ImageCroppedEvent containing the cropped image blob.
   */
  onBackImageCropped(event: ImageCroppedEvent) {
    this.croppedBackImageBlob = event.blob ?? null;
    const reader = new FileReader();

    reader.onload = () => {
      this.croppedBackImage = reader.result as string;
      console.log('Cropped Image Base64:', this.croppedBackImage);
      this.isCroppedImageAvailable = true;
    };

    if (event.blob) {
      reader.readAsDataURL(event.blob);
    }
  }

  /**
   * Applies the cropped image.
   */
  applyCroppedImage() {
    if (this.croppedBackImageBlob) {
      // Create a File from the Blob
      const fileName = 'cropped-back-image.png';
      const croppedFile = new File([this.croppedBackImageBlob], fileName, {
        type: 'image/png',
      });

      // Update backImage and backImagePreview
      this.backImage = croppedFile;
      this.backImagePreview = this.croppedBackImage;

      // Update the files in FilePond
      this.backFiles = [croppedFile];

      this.errorMessage = null;
    } else {
      alert('No cropped image available.');
    }
  }

  /**
   * Handles the 'Next' button click on the 'Crop Image' step.
   */
  async onCroppedImageNext() {
    if (!this.croppedBackImage) {
      alert('Please apply the cropped image first.');
      return;
    }
    this.isProcessing = true;
    this.isCroppedImageProcessing = true;

    try {
      const barcodeText = await this.extractBarcodeData(
        this.backImagePreview as string
      );
      this.licenseData = this.parseBarcodeData(barcodeText);
      this.isProcessing = false;
      this.isCroppedImageProcessing = false;

      // Proceed to final step
      this.stepper.selectedIndex = 3; // Adjust index based on your steps
    } catch (error) {
      console.error('Barcode extraction failed after cropping:', error);
      this.isProcessing = false;
      this.isCroppedImageProcessing = false;
      this.upscaleAttempt++;

      if (this.upscaleAttempt < this.maxUpscaleAttempts) {
        // Retry extraction without alerting the user
        // Upscale the image further
        this.upscaleWidth += 500;
        this.upscaleHeight += 500;
        await this.upscaleBackImage();

        // Reset cropping tool
        this.isCroppingToolReady = false;
        this.isCroppedImageAvailable = false;
        this.croppedBackImage = '';
        this.croppedBackImageBlob = null;

        // The cropping tool will reload with the new upscaled image
      } else {
        this.errorMessage =
          'Failed to extract data from the barcode after multiple attempts. Please try uploading a clearer image.';
        alert(this.errorMessage);

        // Reset to allow the user to upload a new image
        this.stepper.selectedIndex = 1; // Go back to upload back image step
        this.needsCropping = false;
        this.isCropping = false;
        this.upscaleAttempt = 0; // Reset upscale attempts

        // Reset upscale dimensions
        this.upscaleWidth = 1920;
        this.upscaleHeight = 1920;
      }
    }
  }

  /**
   * Upscales a base64 image to specified width and height, matching the user's upscaling logic.
   * @param imageBase64 The base64 string of the image to upscale.
   * @param width The target width for upscaling.
   * @param height The target height for upscaling.
   * @returns A Promise that resolves to the upscaled base64 image string.
   */
  async upscaleImage(
    imageBase64: string,
    width: number,
    height: number
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const img = new Image();
      img.src = imageBase64;
      img.crossOrigin = 'Anonymous'; // To avoid CORS issues
      img.onload = async () => {
        const orientation = await getOrientation(imageBase64);

        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Cannot get canvas context');
          return;
        }

        // Adjust canvas size and transformations based on orientation
        if (orientation > 4) {
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }

        // Apply transformations based on orientation
        switch (orientation) {
          case 2:
            // Horizontal flip
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            break;
          case 3:
            // 180° rotate
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate(Math.PI);
            break;
          case 4:
            // Vertical flip
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            break;
          case 5:
            // Vertical flip + 90° rotate right
            ctx.rotate(0.5 * Math.PI);
            ctx.scale(1, -1);
            break;
          case 6:
            // 90° rotate right
            ctx.translate(canvas.width, 0);
            ctx.rotate(0.5 * Math.PI);
            break;
          case 7:
            // Horizontal flip + 90° rotate right
            ctx.translate(canvas.width, 0);
            ctx.rotate(0.5 * Math.PI);
            ctx.scale(-1, 1);
            break;
          case 8:
            // 90° rotate left
            ctx.translate(0, canvas.height);
            ctx.rotate(-0.5 * Math.PI);
            break;
          default:
            break;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let upscaledImage = canvas.toDataURL('image/png', 0.9);
        resolve(upscaledImage);
      };
      img.onerror = (error) => reject(error);
    });
  }

  /**
   * Image Validation
   */
  validateImage(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png'];
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (!validTypes.includes(file.type)) {
      return false;
    }
    if (file.size > maxSize) {
      return false;
    }
    return true;
  }

  /**
   * Extract Barcode Data using ZXing from Base64 Image
   */
  async extractBarcodeData(base64Image: string): Promise<string> {
    const file = this.base64ToFile(base64Image, 'back-image.png');
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

    const codeReader = new BrowserMultiFormatReader(hints);

    try {
      const result: Result = await codeReader.decodeFromImageUrl(
        createImageUrlFromFile(file)
      );
      return result.getText();
    } catch (error) {
      console.log(error, 'extractBarcodeData');
      throw new Error('Barcode decoding failed.');
    }
  }

  /**
   * Utility to convert base64 to File
   */
  base64ToFile(data: string, filename: string): File {
    const arr = data.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Parse Barcode Data based on AAMVA Standards
   */
  parseBarcodeData(rawData: string): any {
    const data: { [key: string]: any } = {};

    // Split the raw data into lines, handling different line endings
    const lines = rawData.split(/\r?\n/);

    // Define a mapping of codes to their respective data fields
    const fieldMappings: { [key: string]: string } = {
      DAA: 'FullName',
      DCS: 'CustomerFamilyName',
      DAC: 'CustomerFirstName',
      DAD: 'MiddleName',
      DBA: 'LicenseExpirationDate',
      DBB: 'DateOfBirth',
      DBC: 'Sex',
      DBD: 'IssueDate',
      DBE: 'Address',
      DBF: 'City',
      DBG: 'State',
      DBH: 'PostalCode',
      DAJ: 'LicenseNumber',
      DCB: 'CustomerSuffix',
      DCD: 'VehicleClass',
      DCAC: 'LicenseType',
      DDEN: 'DenominationCode',
      DDF: 'AlternateFirstName',
      DADR: 'ResidenceStreetAddress',
      DDGN: 'ResidenceStreetAddress2',
      DAY: 'Suffix',
      DAU: 'Height',
      DAG: 'ResidenceCity',
      DAK: 'AuditInformation',
      DAQ: 'DriverLicenseNumber',
      DCF: 'DocumentFilingNumber',
      DCG: 'Country',
      DAZ: 'EyeColor',
      DCK: 'CheckDigit',
      DCL: 'HairColor',
      DDA: 'DocumentDiscriminator',
      DDB: 'DocumentVersion',
      DAW: 'Weight',
      DDK: 'DocumentSecondaryID',
      ZTZT: 'Composite',
    };

    for (const line of lines) {
      // Skip empty lines or lines that don't start with uppercase letters
      if (!line.trim() || !/^[A-Z]{3}/.test(line)) {
        continue;
      }

      // Extract the key (first three letters) and value (rest of the line)
      const key = line.substring(0, 3);
      const value = line.substring(3).trim();

      if (fieldMappings[key]) {
        // Handle specific formatting for certain keys
        if (['DBA', 'DBB', 'DBD'].includes(key)) {
          data[fieldMappings[key]] = this.formatDate(value);
        } else {
          data[fieldMappings[key]] = value;
        }
      } else {
        console.warn(`Unmapped key encountered: ${key} with value: ${value}`);
      }
    }

    return data;
  }

  /**
   * Format Date from YYMMDD to YYYY-MM-DD
   */
  formatDate(dateString: string): string {
    // Assuming the date is in YYMMDD format
    if (dateString.length === 6) {
      const year = parseInt(dateString.substring(0, 2), 10) + 2000;
      const month = dateString.substring(2, 4);
      const day = dateString.substring(4, 6);
      return `${year}-${month}-${day}`;
    }
    return dateString;
  }

  /**
   * Copy JSON Data to Clipboard
   */
  copyToClipboard() {
    const jsonData = JSON.stringify(this.licenseData, null, 2);
    navigator.clipboard.writeText(jsonData).then(
      () => {
        alert('JSON data copied to clipboard.');
      },
      () => {
        alert('Failed to copy data.');
      }
    );
  }

  /**
   * Download JSON Data as a File
   */
  downloadJSON() {
    const jsonData = JSON.stringify(this.licenseData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'license-data.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Retry Extraction
   */
  retry() {
    this.stepper.selectedIndex = 1; // Go back to the back image upload step
    this.errorMessage = null;
    this.isProcessing = false;
    this.upscaleAttempt = 0; // Reset upscale attempts

    // Reset processing states
    this.isBackImageProcessing = false;
    this.isCropping = false;
    this.needsCropping = false;

    // Reset upscale dimensions
    this.upscaleWidth = 1920;
    this.upscaleHeight = 1920;
  }
}

// Utility Function (Keep this outside the class)
function createImageUrlFromFile(file: File): string {
  // Ensure the file is an image
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  // Generate and return a temporary URL for the image file
  return URL.createObjectURL(file);
}

async function getOrientation(imageBase64: string): Promise<number> {
  const base64Data = imageBase64.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/jpeg' });
  const tags = await exifr.parse(blob, ['Orientation']);
  return tags?.Orientation || 1;
}
