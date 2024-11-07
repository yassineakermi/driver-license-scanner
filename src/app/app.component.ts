// src/app/app.component.ts
import { Component } from '@angular/core';
import { StepperComponent } from './stepper/stepper.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StepperComponent],
  template: `
  
    <div class="container">
      <h1>Driver's License Scanner</h1>
      <app-stepper></app-stepper>
    </div>
  `,
  styles: [`
    h1 {
      text-align: center;
      margin-bottom: 40px;
      color: #3f51b5;
    }
    div {
      max-width: 800px;
      margin: auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    pre {
      background-color: #e0e0e0;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
  `]
})
export class AppComponent {}
