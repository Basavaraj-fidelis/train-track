
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, Calendar, User, BookOpen, CheckCircle } from "lucide-react";

interface CertificateTemplateProps {
  certificate: {
    id: string;
    certificateData: {
      participantName: string;
      courseName: string;
      score: number;
      completionDate: string;
      certificateId: string;
      digitalSignature?: string;
    };
    issuedAt: string;
  };
  onDownload?: () => void;
}

export default function CertificateTemplate({ certificate, onDownload }: CertificateTemplateProps) {
  const { certificateData } = certificate;

  return (
    <Card className="w-full max-w-4xl mx-auto bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 shadow-lg">
      <CardContent className="p-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Award className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-blue-900 mb-2">CERTIFICATE OF COMPLETION</h1>
          <div className="w-24 h-1 bg-blue-600 mx-auto"></div>
        </div>

        {/* Certificate Content */}
        <div className="text-center space-y-6">
          <p className="text-lg text-gray-700">This is to certify that</p>
          
          <h2 className="text-3xl font-bold text-blue-800 border-b-2 border-blue-200 pb-2 inline-block px-8">
            {certificateData.participantName}
          </h2>
          
          <p className="text-lg text-gray-700">has successfully completed the training course</p>
          
          <h3 className="text-2xl font-semibold text-blue-700 bg-blue-50 py-3 px-6 rounded-lg inline-block">
            {certificateData.courseName}
          </h3>
          
          <div className="flex justify-center items-center space-x-8 mt-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-gray-700">Score Achieved</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{certificateData.score}%</p>
            </div>
            
            <div className="w-px h-12 bg-gray-300"></div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-700">Completion Date</span>
              </div>
              <p className="text-lg text-blue-600">{certificateData.completionDate}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-end">
            <div className="text-left">
              <p className="text-sm text-gray-600 mb-1">Certificate ID</p>
              <p className="font-mono text-sm font-semibold text-gray-800">{certificateData.certificateId}</p>
            </div>
            
            <div className="text-center">
              <div className="w-48 border-b-2 border-gray-400 mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Training Administrator</p>
              <p className="text-xs text-gray-500">TrainTrack Learning Management System</p>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Issued Date</p>
              <p className="text-sm font-semibold text-gray-800">
                {new Date(certificate.issuedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          {certificateData.digitalSignature && (
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 mb-1">Digitally Acknowledged by Participant</p>
              <p className="text-sm font-semibold text-blue-700 italic">
                "{certificateData.digitalSignature}"
              </p>
            </div>
          )}
        </div>
        
        {/* Download Button */}
        {onDownload && (
          <div className="text-center mt-8">
            <Button onClick={onDownload} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              Download Certificate
            </Button>
          </div>
        )}
        
        {/* Verification Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            This certificate is digitally generated and authenticated. 
            For verification, please contact the training administrator with the certificate ID.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
