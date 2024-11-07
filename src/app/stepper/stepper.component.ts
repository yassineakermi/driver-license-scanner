// src/app/stepper/stepper.component.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

// Angular Material Modules
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatStepper } from '@angular/material/stepper';

// ngx-filepond Modules
import { FilePondModule } from 'ngx-filepond';
import { registerPlugin } from 'ngx-filepond';

// FilePond Plugins
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';
import FilePondPluginImageCrop from 'filepond-plugin-image-crop';

// Register FilePond plugins
registerPlugin(
  FilePondPluginImagePreview,
  FilePondPluginFileValidateType,
  FilePondPluginImageCrop
);

// ZXing for barcode decoding
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  Result,
} from '@zxing/library';

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
  ],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.css'],
})
export class StepperComponent implements OnInit {
  frontForm: FormGroup;
  backForm: FormGroup;
  frontImage: File | null = null;
  backImage: File | null = null;
  frontImagePreview: string | ArrayBuffer | null = null;
  backImagePreview: string | ArrayBuffer | null = null;

  selectedState: string | null = null;
  licenseData: any = null; // Changed from {} to any to allow dynamic properties
  isProcessing: boolean = false;
  errorMessage: string | null = null;
  @ViewChild('stepper') stepper!: MatStepper;

  // FilePond Options (Optional Customization)
  frontPondOptions: any = {
    allowImageCrop: true,
    imageCropAspectRatio: '1.58:1',
    acceptedFileTypes: ['image/jpeg', 'image/png'],
    maxFileSize: '5MB',
    allowMultiple: false,
    labelIdle:
      'Drag & Drop your front license or <span class="filepond--label-action">Browse</span>',
  };

  backPondOptions: any = {
    allowImageCrop: true,
    imageCropAspectRatio: '1.58:1',
    acceptedFileTypes: ['image/jpeg', 'image/png'],
    maxFileSize: '5MB',
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
  }

  ngOnInit(): void {}

  // Handle Front Image Upload
  onFrontImageAdded(event: any) {
    const file: File = event.file.file;
    if (this.validateImage(file)) {
      this.frontImage = file;
      this.frontForm.patchValue({ frontImage: file });

      const reader = new FileReader();
      reader.onload = () => {
        this.frontImagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      alert(
        'Invalid front image. Please upload a valid JPEG or PNG image under 5MB.'
      );
      event.file.rejectFile();
    }
  }

  // Handle Back Image Upload
  onBackImageAdded(event: any) {
    const file: File = event.file.file;
    if (this.validateImage(file)) {
      this.backImage = file;
      this.backForm.patchValue({ backImage: file });

      const reader = new FileReader();
      reader.onload = () => {
        this.backImagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      alert(
        'Invalid back image. Please upload a valid JPEG or PNG image under 5MB.'
      );
      event.file.rejectFile();
    }
  }

  // Image Validation
  validateImage(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!validTypes.includes(file.type)) {
      return false;
    }
    if (file.size > maxSize) {
      return false;
    }
    return true;
  }

  // Submit and Process Data
  async onSubmit() {
    if (this.backImage) {
      this.isProcessing = true;
      this.errorMessage = null;
      this.licenseData = null;
  
      try {
        const barcodeText = await this.extractBarcodeData(this.backImage);
        console.log(barcodeText, 'barcodeText');
        this.licenseData = this.parseBarcodeData(barcodeText);
        this.stepper.next(); // Navigate to the third step
      } catch (error) {
        console.error(error);
        this.errorMessage =
          'Failed to extract data from the barcode. Please ensure the image is clear and try again.';
      } finally {
        this.isProcessing = false;
      }
    } else {
      alert('Please upload both front and back images.');
    }
  }
  

  // Extract Barcode Data using ZXing
  async extractBarcodeData(file: File): Promise<string> {
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

    const codeReader = new BrowserMultiFormatReader(hints);
    codeReader
      .decodeFromImageUrl(createImageUrlFromFile(file))
      .then((result: Result) => {
        return result.getText();
      })
      .catch((error) => {
        throw new Error('Barcode decoding failed.');
      });

    // Since decodeFromImage returns a Promise, we need to await it
    try {
      const result: Result = await codeReader.decodeFromImageUrl(
        createImageUrlFromFile(file)
      );
      return result.getText();
    } catch (error) {
      throw new Error('Barcode decoding failed.');
    }
  }

  // Load Image as HTMLImageElement
  loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Parse Barcode Data based on AAMVA Standards
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

  // Format Date from YYMMDD to YYYY-MM-DD
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

  // Copy JSON Data to Clipboard
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

  // Download JSON Data as a File
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

  // Retry Extraction
  retry() {
    this.licenseData = null;
    this.errorMessage = null;
    this.backForm.reset();
    this.backImage = null;
    this.backImagePreview = null;
  }
}

function createImageUrlFromFile(file: File): string {
  // Ensure the file is an image
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  // Generate and return a temporary URL for the image file
  return URL.createObjectURL(file);
}
