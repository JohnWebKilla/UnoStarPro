import React from "react";

interface PdfViewerProps {
  url: string;
  title?: string;
  width?: string | number;
  height?: string | number;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  title = "PDF Document",
  width = "100%",
  height = "600px",
}) => {
  return (
    <div className="pdf-viewer-container">
      <iframe
        src={url}
        title={title}
        width={width}
        height={height}
        style={{
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      >
        <p>
          Your browser does not support PDFs.
          <a href={url} download>
            Download the PDF
          </a>
        </p>
      </iframe>
    </div>
  );
};

export default PdfViewer;
