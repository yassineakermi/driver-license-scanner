import { parse } from 'exifr';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';

import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

// Angular Material Modules
import {
  MatStepperModule,
  MatStepper,
  StepperOrientation,
} from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

// Angular CDK for BreakpointObserver
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { firstValueFrom, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

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

// Import ngx-scanner
import { ZXingScannerModule } from '@zxing/ngx-scanner';

// Import CommonModule
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
    HttpClientModule,
    ZXingScannerModule, // Add this
  ],
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.css'],
})
export class StepperComponent implements OnInit {
  frontForm: FormGroup;
  backForm: FormGroup;
  frontImage: File | null = null;
  backImage: File | undefined = undefined;
  frontImagePreview: string | undefined = undefined;
  backImagePreview: string | undefined = undefined;
  licenseData: any = null;
  @ViewChild('stepper') stepper!: MatStepper;

  // FilePond Files Arrays
  backFiles: any[] = []; // For back image files
  frontFiles: File[] = []; // For front image files

  // Barcode scanning properties
  availableDevices: MediaDeviceInfo[] = [];
  currentDevice: MediaDeviceInfo | undefined;
  hasDevices: boolean = false;
  hasPermission: boolean = false;
  scanResult: string = '';
  formatsEnabled: BarcodeFormat[] = [BarcodeFormat.PDF_417];
  errorMessage: string | null = null;
  isScanning: boolean = true;

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

  // Stepper orientation observable
  stepperOrientation: Observable<StepperOrientation>;

  constructor(
    private fb: FormBuilder,
    private breakpointObserver: BreakpointObserver,
    private http: HttpClient
  ) {
    this.frontForm = this.fb.group({
      frontImage: [null, Validators.required],
    });
    this.backForm = this.fb.group({
      backImage: [null, Validators.required],
    });

    this.stepperOrientation = this.breakpointObserver
      .observe([Breakpoints.HandsetPortrait])
      .pipe(map(({ matches }) => (matches ? 'vertical' : 'horizontal')));
  }

  ngOnInit(): void {}

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
        this.frontImagePreview = reader.result as string;
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
        this.backImagePreview = reader.result as string;
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
   * Handles the removal of the front image.
   */
  onFrontImageRemoved(event: any) {
    // Clear the front image properties
    this.frontImage = null;
    this.frontImagePreview = undefined;

    // Clear the frontFiles array
    this.frontFiles = [];

    // Reset the front form control
    this.frontForm.patchValue({ frontImage: null });
  }

  /**
   * Handles the removal of the back image.
   */
  onBackImageRemoved(event: any) {
    // Clear the back image properties
    this.backImage = undefined;
    this.backImagePreview = undefined;

    // Clear the backFiles array
    this.backFiles = [];

    // Reset the back form control
    this.backForm.patchValue({ backImage: null });
  }

  /**
   * Handles the 'Next' button click on the 'Upload Back Image' step.
   */
  onBackImageNext() {
    this.stepper.next(); // Move to the scanning step
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
   * Barcode scanning methods
   */

  // When cameras are found
  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    this.hasDevices = Boolean(devices && devices.length);
    if (this.hasDevices) {
      const rearCamera = devices.find((device) =>
        /back|rear|environment/i.test(device.label)
      );
      this.currentDevice = rearCamera || devices[0];
    } else {
      this.errorMessage = 'No cameras found.';
    }
  }

  // When permission is granted or denied
  onHasPermission(has: boolean): void {
    this.hasPermission = has;
    if (!has) {
      this.errorMessage = 'Camera permission is required.';
    } else {
      this.errorMessage = null;
    }
  }

  // When a scan is successful
  onScanSuccess(result: string): void {
    this.scanResult = result;
    this.isScanning = false; // Stop scanning

    try {
      this.licenseData = this.parseBarcodeData(result);
      // Proceed to the next step
      this.stepper.next();
    } catch (error) {
      this.errorMessage = 'Failed to parse barcode data.';
    }
  }

  // When scanning fails
  onScanFailure(error: any): void {
    // You can provide feedback here if needed
    console.log('Scan failure:', error);
  }

  // When a scan error occurs
  onScanError(error: any): void {
    this.errorMessage = 'Error during scanning: ' + error;
  }

  // Handle cameras not found
  onCamerasNotFound(event: any): void {
    this.errorMessage = 'No cameras found.';
  }

  // Handle permission denied
  onPermissionDenied(event: any): void {
    this.errorMessage = 'Camera permission was denied.';
  }

  // Retry scanning
  retryScanning(): void {
    this.errorMessage = null;
    this.isScanning = true;
    this.scanResult = '';
  }
}
