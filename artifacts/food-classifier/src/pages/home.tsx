import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, CheckCircle2, Loader2, Clock, Info, Search, List, BarChart3, History } from "lucide-react";
import { 
  useGetClassificationHistory, 
  getGetClassificationHistoryQueryKey,
  useGetClassificationStats,
  getGetClassificationStatsQueryKey
} from "@workspace/api-client-react";
import type { ClassificationResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";

// The food emojis mapped from the class
const FOOD_EMOJIS: Record<string, string> = {
  pizza: "🍕",
  steak: "🥩",
  sushi: "🍣",
};

export default function Home() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: history = [], isLoading: historyLoading } = useGetClassificationHistory();
  const { data: stats, isLoading: statsLoading } = useGetClassificationStats();

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, WebP).",
        variant: "destructive",
      });
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setSelectedImage(objectUrl);
    setResult(null);
    setIsClassifying(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const response = await fetch("/api/classify", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Classification failed");
      }
      
      const data: ClassificationResult = await response.json();
      setResult(data);
      
      // Invalidate queries to refresh history and stats
      queryClient.invalidateQueries({ queryKey: getGetClassificationHistoryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetClassificationStatsQueryKey() });
      
    } catch (err) {
      console.error(err);
      toast({
        title: "Classification Failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
      setSelectedImage(null);
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6 md:px-8">
      <div className="w-full max-w-5xl space-y-8">
        
        <header className="flex flex-col items-center text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
            <Search className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground font-sans">
            Food Vision<span className="text-primary">.ai</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl font-medium">
            Upload an image of pizza, steak, or sushi. Our Vision Transformer model will analyze its features and classify it with precision.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: UPLOAD & RESULTS */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* UPLOAD AREA */}
            <Card className="border-2 shadow-sm overflow-hidden border-border/60">
              <CardContent className="p-0">
                <div 
                  className={`relative flex flex-col items-center justify-center p-12 transition-all duration-200 ease-in-out cursor-pointer min-h-[360px]
                    ${dragActive ? 'bg-primary/5 border-primary border-dashed' : 'bg-card hover:bg-muted/30'}
                    ${selectedImage ? 'p-0' : ''}
                  `}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isClassifying && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    accept="image/jpeg, image/png, image/webp"
                    className="hidden"
                  />

                  {selectedImage ? (
                    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center bg-black/5">
                      <img 
                        src={selectedImage} 
                        alt="Selected food" 
                        className={`max-h-[500px] w-auto object-contain transition-opacity duration-500 ${isClassifying ? 'opacity-40 blur-sm' : 'opacity-100'}`} 
                      />
                      {isClassifying && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-primary drop-shadow-md bg-background/20 backdrop-blur-[2px]">
                          <div className="bg-card p-6 rounded-2xl shadow-xl flex flex-col items-center border border-border">
                            <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                            <p className="font-semibold text-foreground text-lg">Analyzing features...</p>
                            <p className="text-sm text-muted-foreground mt-1">Running Vision Transformer</p>
                          </div>
                        </div>
                      )}
                      {!isClassifying && (
                        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full text-sm font-medium border border-border/50 shadow-sm opacity-0 hover:opacity-100 transition-opacity">
                          Click to upload new image
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center space-y-4 pointer-events-none">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                        <UploadCloud className="w-10 h-10" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Drop your image here</h3>
                        <p className="text-muted-foreground mt-1">or click to browse from your computer</p>
                      </div>
                      <div className="flex gap-4 text-xs font-medium text-muted-foreground mt-4">
                        <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> JPEG</span>
                        <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> PNG</span>
                        <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> WEBP</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RESULTS PANEL */}
            {result && !isClassifying && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-2 border-primary/20 shadow-md bg-card overflow-hidden">
                  <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2 text-primary">
                      <CheckCircle2 className="w-5 h-5" /> 
                      Classification Complete
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-background px-2.5 py-1 rounded-full border border-border/50 shadow-sm">
                      <Clock className="w-3.5 h-3.5" />
                      {result.processing_time_ms}ms
                    </div>
                  </div>
                  
                  <CardContent className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                      
                      <div className="flex-shrink-0 flex flex-col items-center text-center">
                        <div className="text-8xl mb-4 drop-shadow-xl relative">
                          {FOOD_EMOJIS[result.predicted_class] || "🍽️"}
                          <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 shadow-md border border-border">
                            <div className="bg-green-500 w-4 h-4 rounded-full"></div>
                          </div>
                        </div>
                        <h3 className="text-3xl font-extrabold capitalize mb-1 text-foreground">
                          {result.predicted_class}
                        </h3>
                        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold mt-2 inline-flex items-center gap-1.5">
                          {(result.confidence * 100).toFixed(1)}% Match
                        </div>
                      </div>

                      <div className="w-full h-px md:w-px md:h-auto bg-border/60 mx-2" />

                      <div className="flex-grow w-full space-y-5 pt-2">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Confidence Breakdown</h4>
                        
                        {result.all_predictions.sort((a, b) => b.confidence - a.confidence).map((pred) => (
                          <div key={pred.label} className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                              <span className="capitalize text-foreground flex items-center gap-2">
                                <span className="text-lg leading-none">{FOOD_EMOJIS[pred.label]}</span>
                                {pred.label}
                              </span>
                              <span className={pred.label === result.predicted_class ? 'text-primary font-bold' : 'text-muted-foreground'}>
                                {(pred.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            <Progress 
                              value={pred.confidence * 100} 
                              className={`h-2.5 ${pred.label === result.predicted_class ? '[&>div]:bg-primary' : '[&>div]:bg-muted-foreground/30 bg-muted'}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: STATS & HISTORY */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* STATS PANEL */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Global Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {statsLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-10 bg-muted rounded-md w-full"></div>
                    <div className="h-16 bg-muted rounded-md w-full"></div>
                  </div>
                ) : stats ? (
                  <>
                    <div className="flex justify-between items-baseline pb-4 border-b border-border/60">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Total Scans</p>
                        <p className="text-3xl font-extrabold text-foreground">{stats.total_classifications.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Avg Confidence</p>
                        <p className="text-xl font-bold text-primary">{(stats.avg_confidence * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium"><span className="text-lg">🍕</span> Pizza</span>
                        <span className="font-bold bg-muted px-2 py-0.5 rounded text-foreground">{stats.pizza_count}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium"><span className="text-lg">🥩</span> Steak</span>
                        <span className="font-bold bg-muted px-2 py-0.5 rounded text-foreground">{stats.steak_count}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium"><span className="text-lg">🍣</span> Sushi</span>
                        <span className="font-bold bg-muted px-2 py-0.5 rounded text-foreground">{stats.sushi_count}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">No stats available yet.</div>
                )}
              </CardContent>
            </Card>

            {/* HISTORY LIST */}
            <Card className="shadow-sm border-border/60 flex flex-col max-h-[500px]">
              <CardHeader className="pb-3 px-5 pt-5 border-b border-border/60">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <History className="w-4 h-4" /> Recent Scans
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto overflow-x-hidden flex-grow scrollbar-thin">
                {historyLoading ? (
                  <div className="p-5 space-y-4 animate-pulse">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex gap-3 items-center">
                        <div className="w-10 h-10 bg-muted rounded-full shrink-0"></div>
                        <div className="space-y-2 flex-grow">
                          <div className="h-3 bg-muted rounded w-24"></div>
                          <div className="h-2 bg-muted rounded w-16"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : history.length > 0 ? (
                  <ul className="divide-y divide-border/40">
                    {history.map((item) => (
                      <li key={item.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                          {FOOD_EMOJIS[item.predicted_class] || "🍽️"}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="font-bold text-sm capitalize text-foreground truncate">
                            {item.predicted_class}
                          </p>
                          <div className="flex items-center text-xs text-muted-foreground gap-2 mt-0.5">
                            <span className="font-medium text-primary">{(item.confidence * 100).toFixed(0)}%</span>
                            <span>&bull;</span>
                            <span className="truncate">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-8 text-center flex flex-col items-center justify-center h-full text-muted-foreground">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                      <List className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-sm font-medium">No history yet</p>
                    <p className="text-xs mt-1 max-w-[200px]">Classify your first image to start building a log.</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </main>
        
        <footer className="text-center text-sm text-muted-foreground py-8 border-t border-border mt-12">
          <p className="flex items-center justify-center gap-1.5">
            <Info className="w-4 h-4" /> 
            Powered by a Vision Transformer model running on the server.
          </p>
        </footer>
      </div>
    </div>
  );
}
