
import { Component, inject, signal, OnInit, computed, ViewChild, ElementRef, AfterViewChecked, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService, LogicConflict, RemixData, ReferenceStandard, FullAnalysisReport, DepthElement } from '../../services/workflow.service';
import { GeminiService } from '../../services/gemini.service';
import { IconComponent } from '../ui/icon.component';
import { LoadingOverlayComponent } from '../ui/loading-overlay.component';

@Component({
  selector: 'app-check',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, LoadingOverlayComponent],
  template: `
    <div class="flex flex-col h-full bg-[var(--vibe-bg-main)] relative">
      
      <!-- Header -->
      <div class="flex items-center p-4 bg-[var(--vibe-bg-card)] border-b shadow-sm shrink-0 border-[var(--vibe-border)] z-10">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-full bg-[var(--vibe-bg-header)]">
              <app-icon name="fact_check" [size]="24" class="text-[var(--vibe-accent)]"></app-icon>
          </div>
          <h2 class="text-lg font-bold text-[var(--vibe-accent)] font-display">{{ wf.t('check.title') }}</h2>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto scroll-smooth" #scrollContainer (scroll)="onScroll()">
        <div class="p-4 md:p-6 max-w-4xl mx-auto space-y-8 animate-fadeIn pb-20">
          
          @if (isAnalyzing()) {
             <div class="h-64"></div>
          }

          @if (!isAnalyzing()) {
            
            <!-- SECTION 1: LOGIC CHECK -->
            <div class="space-y-4">
               <h3 class="text-lg font-bold text-[var(--vibe-accent)] flex items-center gap-2 uppercase tracking-wide opacity-80">
                  <app-icon name="psychology_alt" [size]="20"></app-icon>
                  {{ wf.t('check.logic_title') }}
               </h3>
               
               @if (report()?.logical_conflicts?.length === 0) {
                  <div class="p-6 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 flex items-center gap-3 text-green-800 dark:text-green-200">
                     <app-icon name="check_circle" [size]="24"></app-icon>
                     <span class="font-bold">{{ wf.t('check.good') }}</span>
                  </div>
               } @else {
                  <div class="grid gap-4">
                    @for (conflict of report()?.logical_conflicts; track $index) {
                       <div class="bg-[var(--vibe-bg-card)] rounded-xl border shadow-sm overflow-hidden animate-slideUp relative"
                            [ngClass]="{
                              'border-red-400': conflict.severity === 'high',
                              'border-yellow-400': conflict.severity === 'medium',
                              'border-[var(--vibe-border)]': conflict.severity === 'low'
                            }">
                          
                          <div class="p-4 flex gap-4">
                             <!-- Severity Icon -->
                             <div class="mt-1 shrink-0">
                                @if (conflict.severity === 'high') {
                                   <app-icon name="error" [size]="24" class="text-red-500"></app-icon>
                                } @else if (conflict.severity === 'medium') {
                                   <app-icon name="warning" [size]="24" class="text-yellow-500"></app-icon>
                                } @else {
                                   <app-icon name="info" [size]="24" class="text-blue-400"></app-icon>
                                }
                             </div>
                             
                             <div class="space-y-2 flex-1">
                                <h4 class="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                                   {{ conflict.type }}
                                   @if (conflict.severity === 'high') {
                                      <span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">Critical</span>
                                   }
                                </h4>
                                <p class="text-sm text-[var(--text-secondary)]">{{ conflict.detail }}</p>
                                
                                <div class="bg-[var(--vibe-bg-header)]/30 p-3 rounded-lg text-xs flex gap-2">
                                   <app-icon name="lightbulb" [size]="16" class="text-[var(--vibe-accent)] shrink-0"></app-icon>
                                   <span class="text-[var(--text-secondary)] italic">{{ conflict.suggestion }}</span>
                                </div>
                             </div>
                          </div>

                          <!-- Actions -->
                          <div class="px-4 py-2 border-t bg-[var(--vibe-bg-header)]/10 flex justify-end gap-2" 
                               [ngClass]="{
                                 'border-red-200': conflict.severity === 'high',
                                 'border-[var(--vibe-border)]': conflict.severity !== 'high'
                               }">
                             <button (click)="ignoreConflict($index)" class="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:bg-black/5">
                                {{ wf.t('check.btn_ignore') }}
                             </button>
                             @if (conflict.severity === 'high' || conflict.severity === 'medium') {
                               <button (click)="autoFix($index)" [disabled]="isProcessingAction($index)"
                                       class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--vibe-accent-bg)] text-[var(--vibe-on-accent)] hover:opacity-90 shadow-sm flex items-center gap-1 disabled:opacity-50">
                                  @if (isFixing() === $index) { <span class="animate-spin">↻</span> }
                                  {{ wf.t('check.btn_fix') }}
                               </button>
                             } @else {
                               <button (click)="turnIntoFeature($index)" [disabled]="isProcessingAction($index)"
                                       class="px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--vibe-accent)] text-[var(--vibe-accent)] hover:bg-[var(--vibe-accent-bg)] hover:text-[var(--vibe-on-accent)] transition-colors flex items-center gap-1">
                                  @if (isHarmonizing() === $index) { <span class="animate-spin">↻</span> }
                                  {{ wf.t('check.btn_feature') }}
                               </button>
                             }
                          </div>
                       </div>
                    }
                  </div>
               }
            </div>

            <!-- SECTION 2: BIAS DETECTION -->
            <div class="space-y-4">
               <h3 class="text-lg font-bold text-[var(--vibe-accent)] flex items-center gap-2 uppercase tracking-wide opacity-80">
                  <app-icon name="policy" [size]="20"></app-icon>
                  {{ wf.t('check.bias_title') }}
               </h3>
               
               @if (!report()?.bias_analysis?.bias_detected) {
                  <div class="p-4 rounded-xl border border-[var(--vibe-border)] text-[var(--text-secondary)] text-sm italic flex items-center gap-2 opacity-70">
                     <app-icon name="verified_user" [size]="18"></app-icon>
                     {{ wf.t('check.bias_none') }}
                  </div>
               } @else {
                  <div class="p-5 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 animate-fadeIn">
                     <div class="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-bold mb-2">
                        <app-icon name="auto_awesome" [size]="20"></app-icon>
                        {{ wf.t('check.bias_detected') }}: {{ report()?.bias_analysis?.bias_type }}
                     </div>
                     <p class="text-sm text-[var(--text-primary)] mb-3">{{ report()?.bias_analysis?.evidence }}</p>
                     <div class="bg-white/60 dark:bg-black/20 p-3 rounded-lg text-sm text-purple-900 dark:text-purple-100 font-serif italic mb-4">
                        "{{ report()?.bias_analysis?.gentle_suggestion }}"
                     </div>
                     <!-- DEEP AUDIT BUTTON -->
                     <div class="flex justify-end">
                        <button (click)="openAntiBiasAudit()" class="px-4 py-2 rounded-lg bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 text-xs font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-sm">
                           <app-icon name="hub" [size]="16"></app-icon>
                           {{ wf.t('check.btn_antibias_audit') }}
                        </button>
                     </div>
                  </div>
               }
            </div>

            <!-- SECTION 3: DEPTH ASSESSMENT -->
            <div class="space-y-4">
               <h3 class="text-lg font-bold text-[var(--vibe-accent)] flex items-center gap-2 uppercase tracking-wide opacity-80">
                  <app-icon name="layers" [size]="20"></app-icon>
                  {{ wf.t('check.depth_title') }}
               </h3>
               
               <!-- Score Bar -->
               <div class="flex items-center gap-4 p-4 rounded-xl bg-[var(--vibe-bg-card)] border border-[var(--vibe-border)]">
                  <div class="flex-1">
                     <div class="flex justify-between mb-1 text-xs font-bold uppercase text-[var(--text-secondary)]">
                        <span>{{ wf.t('check.depth_score') }}</span>
                        <span>{{ report()?.depth_assessment?.completeness_score }}%</span>
                     </div>
                     <div class="h-2 bg-[var(--vibe-bg-header)] rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-[var(--vibe-accent)] to-purple-500 transition-all duration-1000"
                             [style.width.%]="report()?.depth_assessment?.completeness_score || 0"></div>
                     </div>
                  </div>
               </div>

               <!-- Missing Elements Cards -->
               @if (report()?.depth_assessment?.missing_elements?.length) {
                  <h4 class="text-xs font-bold uppercase text-[var(--text-secondary)] mt-2">{{ wf.t('check.missing_elements') }}</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                     @for (item of report()?.depth_assessment?.missing_elements; track $index) {
                        <div class="p-4 rounded-xl border border-[var(--vibe-border)] bg-[var(--vibe-bg-card)] flex flex-col justify-between hover:shadow-md transition-all">
                           <div>
                              <div class="text-[10px] font-bold uppercase text-[var(--vibe-accent)] tracking-wider mb-1">{{ item.element }}</div>
                              <h5 class="font-bold text-[var(--text-primary)] text-sm mb-2">{{ item.question }}</h5>
                              <p class="text-xs text-[var(--text-secondary)] opacity-80 mb-4">{{ item.why_important }}</p>
                           </div>
                           <div class="flex justify-end gap-2">
                              <button (click)="skipDepthElement($index)" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1">
                                 {{ wf.t('check.btn_skip_depth') }}
                              </button>
                              <button (click)="addDepthElement(item, $index)" [disabled]="isBrainstorming() === $index"
                                      class="text-xs bg-[var(--vibe-bg-header)] hover:bg-[var(--vibe-accent-bg)] hover:text-[var(--vibe-on-accent)] px-3 py-1.5 rounded-full font-bold transition-colors flex items-center gap-1 disabled:opacity-50">
                                 @if (isBrainstorming() === $index) { <span class="animate-spin">↻</span> }
                                 @else { <app-icon name="add" [size]="14"></app-icon> }
                                 {{ wf.t('check.btn_add_depth') }}
                              </button>
                           </div>
                        </div>
                     }
                  </div>
               }
            </div>

            <!-- Reference Standards (Kept at bottom) -->
            <div class="pt-8 border-t border-[var(--vibe-border)]">
               <div class="flex justify-between items-center mb-4">
                  <div>
                     <h3 class="text-sm font-bold text-[var(--vibe-accent)] uppercase tracking-wider">{{ wf.t('check.standards_title') }}</h3>
                     <p class="text-xs text-[var(--text-secondary)]">{{ wf.t('check.standards_desc') }}</p>
                  </div>
               </div>
               <div class="flex flex-wrap gap-3">
                  @for(std of standards(); track std.id) {
                     <button (click)="openStandard(std)" class="px-4 py-2 rounded-lg border border-[var(--vibe-border)] bg-[var(--vibe-bg-card)] hover:bg-[var(--vibe-bg-header)] transition-colors text-xs font-bold flex items-center gap-2 text-[var(--text-secondary)]">
                        <app-icon [name]="std.type === 'engineering' ? 'precision_manufacturing' : 'psychology'" [size]="16"></app-icon>
                        {{ std.title }}
                     </button>
                  }
               </div>
            </div>

          }
        </div>
      </div>

      <!-- Scroll Button -->
      @if (showScrollButton()) {
        <button (click)="scrollToBottom()" class="absolute bottom-28 right-6 z-20 w-12 h-12 rounded-full bg-[var(--vibe-accent-bg)] text-[var(--vibe-on-accent)] shadow-lg flex items-center justify-center hover:opacity-90 transition-all animate-bounce-in">
          <app-icon name="arrow_downward" [size]="24"></app-icon>
        </button>
      }

      <!-- Footer Navigation -->
      <div class="p-4 bg-[var(--vibe-bg-card)] border-t flex justify-between items-center gap-4 shrink-0 border-[var(--vibe-border)] z-10">
         <button (click)="wf.undo()" class="px-4 py-2 rounded-full text-sm font-medium hover:bg-black/5 transition-colors flex items-center gap-1 text-[var(--text-secondary)]">
            <app-icon name="arrow_back" [size]="18"></app-icon> {{ wf.t('common.back') }}
         </button>
         
         <div class="flex-1 flex justify-center">
            <button (click)="triggerRemix()" [disabled]="isRemixing() || !!wf.state().remixData"
              class="px-6 py-3 rounded-full text-[var(--vibe-on-accent)] font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:opacity-90 bg-gradient-to-r from-purple-500 to-indigo-600 disabled:from-gray-400 disabled:to-gray-500">
              @if (isRemixing()) {
                 <span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              } @else {
                 <app-icon name="upgrade" [size]="20"></app-icon>
              }
              {{ wf.t('check.btn_remix') }}
            </button>
         </div>

         <button (click)="proceedToSim()" 
                 class="px-4 py-2 rounded-full border font-bold hover:bg-black/5 transition-all flex items-center gap-2 border-[var(--vibe-accent)] text-[var(--vibe-accent)]">
           {{ wf.t('check.btn_sim') }} <app-icon name="arrow_forward" [size]="18"></app-icon>
         </button>
      </div>
    </div>

    <!-- Modals (Remix & Standard) -->
    <!-- Reference Standard Modal -->
    @if (activeStandard(); as std) {
       <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn" (click)="closeStandard()">
          <div class="bg-[var(--vibe-bg-card)] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--vibe-border)] animate-slideUp max-h-[90vh]" (click)="$event.stopPropagation()">
             <div class="p-6 border-b border-[var(--vibe-border)] flex justify-between items-start">
                <div>
                   <h3 class="text-xl font-bold text-[var(--text-primary)]">{{ std.title }}</h3>
                   <p class="text-sm opacity-70 mt-1 font-serif">{{ std.description }}</p>
                </div>
                <button (click)="closeStandard()" class="p-2 rounded-full hover:bg-black/10 text-[var(--text-secondary)]">
                   <app-icon name="close" [size]="24"></app-icon>
                </button>
             </div>
             <div class="flex-1 overflow-y-auto p-6 bg-[var(--vibe-bg-input)]">
                @if (comparisonResult()) {
                   <div class="mb-6 p-4 rounded-xl bg-[var(--vibe-bg-header)] border border-[var(--vibe-border)] animate-fadeIn">
                      <h4 class="font-bold text-[var(--vibe-accent)] mb-2 flex items-center gap-2">
                         <app-icon name="analytics" [size]="20"></app-icon> {{ wf.t('check.comparison_title') }}
                      </h4>
                      <pre class="whitespace-pre-wrap text-sm text-[var(--text-primary)] font-serif">{{ comparisonResult() }}</pre>
                   </div>
                }
                <h4 class="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">Standard Content (Read-Only)</h4>
                <div class="p-4 rounded-xl border border-[var(--vibe-border)] bg-[var(--vibe-bg-card)] relative">
                   <pre class="whitespace-pre-wrap text-sm font-mono text-[var(--text-primary)] overflow-x-auto">{{ std.content }}</pre>
                </div>
             </div>
             <div class="p-4 border-t border-[var(--vibe-border)] flex justify-end gap-3 bg-[var(--vibe-bg-card)]">
                <button (click)="closeStandard()" class="px-4 py-2 rounded-full text-sm font-bold text-[var(--text-secondary)] hover:bg-black/5">{{ wf.t('common.close') }}</button>
                <button (click)="compareWith(std)" [disabled]="isComparing()" class="px-6 py-2 rounded-full text-sm font-bold bg-[var(--vibe-accent-bg)] text-[var(--vibe-on-accent)] hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                   @if(isComparing()) { <span class="animate-spin text-xs">↻</span> }
                   {{ wf.t('check.btn_compare') }}
                </button>
             </div>
          </div>
       </div>
    }

    <!-- Remix Result Modal -->
    @if (showRemixModal() && remixData()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn" (click)="showRemixModal.set(false)">
        <div class="bg-[var(--vibe-bg-card)] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--vibe-border)] animate-slideUp" (click)="$event.stopPropagation()">
          <div class="p-6 border-b border-[var(--vibe-border)]">
            <h3 class="text-2xl font-bold text-[var(--vibe-accent)]">{{ wf.t('check.remix_modal.title') }}</h3>
            <p class="text-sm text-[var(--text-secondary)] mt-1">{{ wf.t('check.remix_modal.desc') }}</p>
          </div>
          <div class="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
             @for (key of remixKeys; track key) {
                <label class="block p-4 rounded-lg border border-[var(--vibe-border)] cursor-pointer transition-all hover:bg-[var(--vibe-bg-main)]"
                       [class.bg-[var(--vibe-bg-main)]]="remixSelection()[key]"
                       [class.border-[var(--vibe-accent)]]="remixSelection()[key]">
                  <div class="flex items-start gap-3">
                     <div class="pt-0.5">
                       <input type="checkbox" [checked]="remixSelection()[key]" (change)="toggleRemix(key)" 
                              class="w-5 h-5 rounded border-gray-300 text-[var(--vibe-accent)] focus:ring-[var(--vibe-accent)]">
                     </div>
                     <div>
                        <h4 class="font-bold text-sm uppercase text-[var(--vibe-accent)]/80">{{ wf.t('check.remix_modal.field_' + key) }}</h4>
                        <p class="mt-1 text-sm text-[var(--text-primary)] font-serif">{{ remixData()![key] }}</p>
                     </div>
                  </div>
                </label>
             }
          </div>
          <div class="p-4 bg-[var(--vibe-bg-header)] flex justify-between items-center gap-3">
             <div class="text-xs text-[var(--text-secondary)] pl-2">
                 {{ selectedCount() }} selected
             </div>
             <div class="flex gap-3">
                <button (click)="showRemixModal.set(false)" class="px-6 py-2 rounded-full text-sm font-bold text-[var(--vibe-accent)] hover:bg-black/10">{{ wf.t('common.close') }}</button>
                <button (click)="acceptRemix()" [disabled]="selectedCount() === 0" class="px-6 py-2 rounded-full text-sm font-bold bg-[var(--vibe-accent-bg)] text-[var(--vibe-on-accent)] hover:opacity-90 disabled:opacity-50">{{ wf.t('check.remix_modal.accept') }}</button>
             </div>
          </div>
        </div>
      </div>
    }

    <!-- Loading Overlays -->
    <app-loading-overlay
      [isVisible]="isAnalyzing()"
      [subtitle]="wf.t('check.analyzing_desc')"
      [steps]="analysisSteps"
      iconName="fact_check">
    </app-loading-overlay>

    <app-loading-overlay
      [isVisible]="isRemixing()"
      [subtitle]="wf.t('check.remix_modal.desc')"
      [steps]="remixSteps"
      iconName="upgrade">
    </app-loading-overlay>

    <style>
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.2, 0.0, 0, 1.0) forwards; opacity: 0; animation-fill-mode: forwards; }
      @keyframes bounce-in { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
      .animate-bounce-in { animation: bounce-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    </style>
  `
})
export class CheckComponent implements OnInit, AfterViewChecked {
  wf = inject(WorkflowService);
  private gemini = inject(GeminiService);
  switchToAntiBias = output<void>(); // NEW OUTPUT
  
  isAnalyzing = signal(true);
  
  // New Report State
  report = computed(() => this.wf.state().analysisReport);
  
  isFixing = signal<number | null>(null);
  isHarmonizing = signal<number | null>(null);
  isBrainstorming = signal<number | null>(null);
  isRemixing = signal(false);
  
  // Reference Standards State
  standards = computed(() => this.wf.referenceStandards());
  activeStandard = signal<ReferenceStandard | null>(null);
  isComparing = signal(false);
  comparisonResult = signal('');

  showRemixModal = signal(false);
  remixData = signal<RemixData | null>(null);
  
  // Remix Selection State
  remixKeys: (keyof RemixData)[] = ['inner_voice', 'core_wound', 'secret_desire', 'worldview'];
  remixSelection = signal<Record<keyof RemixData, boolean>>({
      inner_voice: true,
      core_wound: true,
      secret_desire: true,
      worldview: true
  });
  
  analysisSteps = [
    'Scanning Logic Vectors...',
    'Detecting Bias Patterns...',
    'Measuring Character Depth...',
    'Generating 3-Layer Report...'
  ];

  remixSteps = [
    'Deepening Core Wound...',
    'Synthesizing Inner Voice...',
    'Constructing Worldview...',
    'Applying Psychological Layers...'
  ];
  
  selectedCount = computed(() => {
     return Object.values(this.remixSelection()).filter(Boolean).length;
  });

  showScrollButton = signal(false);
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  async ngOnInit() {
    if (!this.wf.state().analysisReport) {
       await this.runAnalysis();
    } else {
       this.isAnalyzing.set(false);
    }
  }

  ngAfterViewChecked() {
    // Initial check
  }

  onScroll() {
    const el = this.scrollContainer.nativeElement;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
    this.showScrollButton.set(!isAtBottom);
  }

  scrollToBottom() {
    try {
      this.scrollContainer.nativeElement.scrollTo({ top: this.scrollContainer.nativeElement.scrollHeight, behavior: 'smooth' });
    } catch(e) {}
  }

  async runAnalysis() {
    this.isAnalyzing.set(true);
    try {
      const persona = this.wf.state().structuredPersona;
      if (persona) {
          // New Deep Analysis
          const result = await this.gemini.analyzePersonaDeeply(persona, this.wf.currentLang());
          this.wf.pushState({ analysisReport: result });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.isAnalyzing.set(false);
    }
  }
  
  isProcessingAction(index: number) {
    return this.isFixing() === index || this.isHarmonizing() === index;
  }

  async autoFix(index: number) {
    this.isFixing.set(index);
    const conflicts = this.report()?.logical_conflicts || [];
    const conflict = conflicts[index];
    
    if (!conflict) return;

    await this.processResolution(index, (persona, conf) => 
        this.gemini.autoFixConflict(persona, conf.detail, conf.suggestion));
    this.isFixing.set(null);
  }

  async turnIntoFeature(index: number) {
    this.isHarmonizing.set(index);
    const conflicts = this.report()?.logical_conflicts || [];
    const conflict = conflicts[index];
    
    if (!conflict) return;

    await this.processResolution(index, (persona, conf) => 
        this.gemini.harmonizeConflict(persona, conf.detail));
    this.isHarmonizing.set(null);
  }

  private async processResolution(index: number, action: (p: any, c: any) => Promise<any>) {
    const currentPersona = this.wf.state().structuredPersona;
    const currentReport = this.report();
    const conflict = currentReport?.logical_conflicts[index];

    if (!currentPersona || !currentReport || !conflict) return;
    
    try {
      const updatedPersona = await action(currentPersona, conflict);
      const newDraft = this.gemini.compileStructuredPrompt(updatedPersona);
      
      // Update State
      this.wf.pushState({
        structuredPersona: updatedPersona,
        currentDraft: newDraft
      });
      
      // Remove resolved conflict from local report state
      const updatedConflicts = currentReport.logical_conflicts.filter((_, i) => i !== index);
      this.wf.pushState({ 
          analysisReport: { ...currentReport, logical_conflicts: updatedConflicts } 
      });

    } catch (e) {
      alert(this.wf.t('check.error.action_failed'));
    }
  }

  ignoreConflict(index: number) {
    const currentReport = this.report();
    if (!currentReport) return;
    const updatedConflicts = currentReport.logical_conflicts.filter((_, i) => i !== index);
    this.wf.pushState({ 
        analysisReport: { ...currentReport, logical_conflicts: updatedConflicts } 
    });
  }

  // --- Depth Methods ---
  skipDepthElement(index: number) {
      const currentReport = this.report();
      if (!currentReport) return;
      const updatedElements = currentReport.depth_assessment.missing_elements.filter((_, i) => i !== index);
      this.wf.pushState({ 
          analysisReport: { ...currentReport, depth_assessment: { ...currentReport.depth_assessment, missing_elements: updatedElements } } 
      });
  }

  async addDepthElement(item: DepthElement, index: number) {
      this.isBrainstorming.set(index);
      const currentPersona = this.wf.state().structuredPersona;
      if (!currentPersona) return;

      try {
          const generatedContent = await this.gemini.brainstormElement(currentPersona, item.question, this.wf.currentLang());
          
          // Append to personality or backstory roughly? 
          // For simplicity, we append to 'Personality' with a newline
          const updatedPersona = { 
              ...currentPersona, 
              personality: currentPersona.personality + `\n\n[Depth: ${item.element}]\n${generatedContent}` 
          };
          const newDraft = this.gemini.compileStructuredPrompt(updatedPersona);

          this.wf.pushState({
            structuredPersona: updatedPersona,
            currentDraft: newDraft
          });
          
          this.skipDepthElement(index); // Remove from list
      } catch(e) {
          console.error(e);
          alert(this.wf.t('check.error.action_failed'));
      } finally {
          this.isBrainstorming.set(null);
      }
  }

  // --- Reference Standards Methods ---
  openStandard(std: ReferenceStandard) {
     this.activeStandard.set(std);
     this.comparisonResult.set('');
  }

  closeStandard() {
     this.activeStandard.set(null);
     this.isComparing.set(false);
  }

  async compareWith(std: ReferenceStandard) {
     const currentDraft = this.wf.state().currentDraft;
     if (!currentDraft) return;
     
     this.isComparing.set(true);
     try {
        const result = await this.gemini.compareWithStandard(currentDraft, std, this.wf.currentLang());
        this.comparisonResult.set(result);
     } catch (e) {
        this.comparisonResult.set('[Error] Analysis failed.');
     } finally {
        this.isComparing.set(false);
     }
  }

  async triggerRemix() {
    this.isRemixing.set(true);
    const persona = this.wf.state().structuredPersona;
    if (!persona) {
        this.isRemixing.set(false);
        return;
    }
    try {
        // Pass language to ensure remix content is in target language
        const result = await this.gemini.remixPersona(persona, this.wf.currentLang());
        this.remixData.set(result);
        
        // Reset selection to all true by default
        this.remixSelection.set({
          inner_voice: true,
          core_wound: true,
          secret_desire: true,
          worldview: true
        });
        
        this.showRemixModal.set(true);
    } catch (e) {
        console.error("Remix failed", e);
        alert(this.wf.t('check.error.remix_failed'));
    } finally {
        this.isRemixing.set(false);
    }
  }
  
  toggleRemix(key: keyof RemixData) {
      this.remixSelection.update(s => ({ ...s, [key]: !s[key] }));
  }
  
  acceptRemix() {
    const persona = this.wf.state().structuredPersona;
    const remix = this.remixData();
    const selection = this.remixSelection();
    
    if (!persona || !remix) return;

    // Only merge selected keys
    const finalRemix: Partial<RemixData> = {};
    if (selection.inner_voice) finalRemix.inner_voice = remix.inner_voice;
    if (selection.core_wound) finalRemix.core_wound = remix.core_wound;
    if (selection.secret_desire) finalRemix.secret_desire = remix.secret_desire;
    if (selection.worldview) finalRemix.worldview = remix.worldview;

    const remixedPersona = { ...persona, ...finalRemix } as any; 
    const newDraft = this.gemini.compileStructuredPrompt(remixedPersona);

    this.wf.pushState({
        structuredPersona: remixedPersona,
        remixData: remix, // Store full remix data for reference, or maybe just selected? Keeping full is fine.
        currentDraft: newDraft
    });
    this.showRemixModal.set(false);
  }

  proceedToSim() {
    this.wf.setStep('simulation');
  }

  // BRIDGE TO ANTI-BIAS TOOL
  openAntiBiasAudit() {
      const currentDraft = this.wf.state().currentDraft;
      this.wf.antiBiasContext.set(currentDraft);
      this.switchToAntiBias.emit();
  }
}
