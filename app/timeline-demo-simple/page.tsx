import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SimpleTimelineDemoPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Simple Timeline Component Demo</h1>
        <p className="text-lg text-muted-foreground">
          Testing basic components first
        </p>
        <div className="flex justify-center gap-2">
          <Badge variant="secondary">Basic Test</Badge>
        </div>
      </div>

      {/* Basic Test */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Component Test</CardTitle>
          <CardDescription>
            This tests if basic UI components are working properly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p>If you can see this, the basic components are working!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 