import { useState } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ReportFormProps {
  onSubmit: (data: { reason: string; notes: string; photo?: File }) => Promise<void>;
}

export default function ReportForm({ onSubmit }: ReportFormProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
    }
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ reason, notes, photo: photo || undefined });
      setReason("");
      setNotes("");
      setPhoto(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <Card>
        <CardHeader>
          <CardTitle>Report Issue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger data-testid="select-reason">
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="traffic">Traffic</SelectItem>
                <SelectItem value="breakdown">Breakdown</SelectItem>
                <SelectItem value="weather">Weather</SelectItem>
                <SelectItem value="accident">Accident</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add detailed notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              data-testid="textarea-notes"
            />
          </div>

          <div className="grid gap-2">
            <Label>Attach Photo</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                id="photo-upload"
                data-testid="input-photo"
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                {photo ? (
                  <div className="space-y-2">
                    <Camera className="h-10 w-10 mx-auto text-primary" />
                    <p className="text-sm font-medium text-primary">{photo.name}</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-gray-400" />
                    <p className="text-sm font-medium text-muted-foreground">
                      <span className="text-primary">Upload a file</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-20 left-4 right-4">
        <Button
          onClick={handleSubmit}
          disabled={!reason || isSubmitting}
          className="w-full py-6 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-lg"
          data-testid="button-send-report"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Report"
          )}
        </Button>
      </div>
    </div>
  );
}
