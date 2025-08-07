
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Clock, Users, TrendingUp } from "lucide-react";

interface PerformanceMetrics {
  serverResponseTime: number;
  activeUsers: number;
  memoryUsage: number;
  cpuUsage: number;
  uptime: string;
  requestsPerMinute: number;
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    serverResponseTime: 245,
    activeUsers: 12,
    memoryUsage: 68,
    cpuUsage: 34,
    uptime: "2d 14h 32m",
    requestsPerMinute: 45
  });

  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Simulate real-time metrics updates
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        serverResponseTime: Math.floor(Math.random() * 200) + 150,
        activeUsers: Math.floor(Math.random() * 20) + 5,
        memoryUsage: Math.floor(Math.random() * 30) + 50,
        cpuUsage: Math.floor(Math.random() * 40) + 20,
        requestsPerMinute: Math.floor(Math.random() * 30) + 30
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return "bg-green-500";
    if (value <= thresholds.warning) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusBadge = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return <Badge className="bg-green-100 text-green-800">Good</Badge>;
    if (value <= thresholds.warning) return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
    return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Server Response Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Response Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{metrics.serverResponseTime}ms</div>
              <p className="text-xs text-muted-foreground">Average response time</p>
            </div>
            {getStatusBadge(metrics.serverResponseTime, { good: 200, warning: 500 })}
          </div>
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{metrics.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Currently online</p>
            </div>
            <Badge className={`${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isConnected ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Memory Usage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.memoryUsage}%</span>
              {getStatusBadge(metrics.memoryUsage, { good: 60, warning: 80 })}
            </div>
            <Progress 
              value={metrics.memoryUsage} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">RAM utilization</p>
          </div>
        </CardContent>
      </Card>

      {/* CPU Usage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.cpuUsage}%</span>
              {getStatusBadge(metrics.cpuUsage, { good: 50, warning: 75 })}
            </div>
            <Progress 
              value={metrics.cpuUsage} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">Processor load</p>
          </div>
        </CardContent>
      </Card>

      {/* Uptime */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div>
            <div className="text-2xl font-bold">{metrics.uptime}</div>
            <p className="text-xs text-muted-foreground">Continuous operation</p>
          </div>
        </CardContent>
      </Card>

      {/* Requests Per Minute */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Request Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div>
            <div className="text-2xl font-bold">{metrics.requestsPerMinute}/min</div>
            <p className="text-xs text-muted-foreground">HTTP requests</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
