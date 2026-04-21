import { ChangeDetectionStrategy, Component, computed, signal, inject } from '@angular/core';  
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
    
}
