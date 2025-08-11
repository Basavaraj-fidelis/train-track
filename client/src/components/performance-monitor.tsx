
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Clock, Users, TrendingUp, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PerformanceMetrics {
  serverResponseTime: number;
  activeUsers: number;
  memoryUsage: number;
  cpuUsage: number;
  uptime: string;
  requestsPerMinute: number;
  dbConnectionStatus: string;
  totalRequests: number;
}

export default function PerformanceMonitor() {
  const [isConnected, setIsConnected] = useState(true);

  // Fetch real performance metrics from API
  const { data: metrics, isError, error } = useQuery({
    queryKey: ["/api/performance-metrics"],
    queryFn: async (): Promise<PerformanceMetrics> => {
      const response = await apiRequest("GET", "/api/performance-metrics");
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: 3,
    retryDelay: 1000,
  });

  useEffect(() => {
    setIsConnected(!isError);
  }, [isError]);

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

  const getConnectionStatusBadge = () => {
    if (isError) {
      return <Badge className="bg-red-100 text-red-800">Disconnected</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
  };

  if (!metrics && !isError) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Show error state with connection status
  if (isError || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-red-600">Disconnected</div>
                <p className="text-xs text-muted-foreground">Unable to fetch metrics</p>
              </div>
              <Badge className="bg-red-100 text-red-800">Error</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <p className="text-xs text-muted-foreground">Database query time</p>
            </div>
            {getStatusBadge(metrics.serverResponseTime, { good: 200, warning: 500 })}
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{metrics.dbConnectionStatus}</div>
              <p className="text-xs text-muted-foreground">Database connection</p>
            </div>
            {getConnectionStatusBadge()}
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
            <p className="text-xs text-muted-foreground">Node.js heap usage</p>
          </div>
        </CardContent>
      </Card>

      {/* System Uptime */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div>
            <div className="text-2xl font-bold">{metrics.uptime}</div>
            <p className="text-xs text-muted-foreground">Process runtime</p>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{metrics.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Current users</p>
            </div>
            <Badge className="bg-blue-100 text-blue-800">
              Online
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Request Metrics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Request Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div>
            <div className="text-2xl font-bold">{metrics.requestsPerMinute}/min</div>
            <p className="text-xs text-muted-foreground">API requests</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
