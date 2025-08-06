import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Bus, User } from "lucide-react";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <GraduationCap className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">TrainTrack</h1>
          <p className="text-xl text-gray-600">Professional Training Management Portal</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
                  <Bus className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">HR Administrator</h3>
                <p className="text-gray-600 mb-6">Manage courses, users, and track training progress</p>
                <Link href="/hr-login">
                  <Button className="w-full">Admin Portal</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                  <User className="text-green-600" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Employee</h3>
                <p className="text-gray-600 mb-6">Access your training courses and track your progress</p>
                <Link href="/employee-login">
                  <Button className="w-full bg-green-600 hover:bg-green-700">Employee Portal</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
