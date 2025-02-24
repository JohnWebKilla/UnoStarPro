import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignaturePad from "react-signature-canvas";
import { toast } from "sonner";

interface SigningDialogProps {
  document: {
    id: string;
    name: string;
    file_path: string;
    signature_fields: Array<{
      id: string;
      type: string;
      label: string;
      required: boolean;
    }>;
  };
  onSign: (signatureData: { [key: string]: string }) => void;
  signerEmail: string;
  signerName: string;
}

export default function SigningDialog({
  document,
  onSign,
  signerEmail,
  signerName,
}: SigningDialogProps) {
  const [selectedField, setSelectedField] = useState<{
    id: string;
    type: string;
    label: string;
    required: boolean;
  } | null>(null);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<{ [key: string]: string }>(
    {}
  );
  const signaturePadRef = useRef<SignaturePad>(null);

  useEffect(() => {
    // Initialize signature data with signer info
    setSignatureData({
      signer_email: signerEmail,
      signer_name: signerName,
    });
  }, [signerEmail, signerName]);

  const handleFieldClick = (field: typeof selectedField) => {
    setSelectedField(field);
    setIsFieldDialogOpen(true);
  };

  const handleFieldSave = (value: string) => {
    if (!selectedField) return;

    const newSignatureData = {
      ...signatureData,
      [selectedField.id]: value,
    };
    setSignatureData(newSignatureData);

    // Check if all required fields are filled
    const allRequiredFieldsSigned = document.signature_fields
      .filter((field) => field.required)
      .every((field) => newSignatureData[field.id]);

    if (allRequiredFieldsSigned) {
      onSign(newSignatureData);
    }

    setIsFieldDialogOpen(false);
    setSelectedField(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-800 mb-2">Instructions:</h3>
        <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
          <li>Click on each field below to add your information</li>
          <li>
            For signature fields, you can draw your signature using your mouse
            or touch screen
          </li>
          <li>All required fields must be completed</li>
          <li>Review your entries before final submission</li>
        </ul>
      </div>

      <div className="space-y-4">
        {document.signature_fields.map((field) => (
          <div
            key={field.id}
            onClick={() => handleFieldClick(field)}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              signatureData[field.id]
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200 hover:border-blue-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{field.label}</h4>
                <p className="text-sm text-gray-500">
                  {field.required ? "Required" : "Optional"}
                </p>
              </div>
              {signatureData[field.id] ? (
                <div className="text-green-600">✓ Completed</div>
              ) : (
                <div className="text-blue-600">Click to fill</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedField && (
        <Dialog
          open={isFieldDialogOpen}
          onOpenChange={() => setIsFieldDialogOpen(false)}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{selectedField.label}</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              {selectedField.type === "signature" ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-2 bg-white">
                    <SignaturePad
                      ref={signaturePadRef}
                      canvasProps={{
                        className: "signature-pad w-full h-[200px]",
                        style: {
                          width: "100%",
                          height: "200px",
                          backgroundColor: "transparent",
                        },
                      }}
                      backgroundColor="rgba(0,0,0,0)"
                    />
                  </div>
                  <Button
                    onClick={() => signaturePadRef.current?.clear()}
                    variant="outline"
                    type="button"
                    className="w-full"
                  >
                    Clear Signature
                  </Button>
                </div>
              ) : selectedField.type === "date" ? (
                <div className="text-center py-4">
                  <p className="text-lg">{new Date().toLocaleDateString()}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{selectedField.label}</Label>
                  <Input
                    defaultValue={signatureData[selectedField.id] || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      if (
                        selectedField.type === "email" &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newValue)
                      ) {
                        return;
                      }
                      handleFieldSave(newValue);
                    }}
                    type={selectedField.type === "email" ? "email" : "text"}
                    placeholder={`Enter ${selectedField.label.toLowerCase()}`}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsFieldDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (
                    selectedField.type === "signature" &&
                    signaturePadRef.current
                  ) {
                    const canvas = signaturePadRef.current.getCanvas();
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                      const signatureData = ctx.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                      );
                      ctx.fillStyle = "#FFFFFF";
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.putImageData(signatureData, 0, 0);
                      handleFieldSave(canvas.toDataURL("image/png"));
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      ctx.putImageData(signatureData, 0, 0);
                    }
                  } else if (selectedField.type === "date") {
                    handleFieldSave(new Date().toLocaleDateString());
                  }
                }}
                disabled={
                  selectedField.type === "signature"
                    ? !signaturePadRef.current?.toData().length
                    : false
                }
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
