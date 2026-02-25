import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Users from "./pages/users";
import Experiments from "./pages/experiments";
import ExperimentDetail from "./pages/experiment-detail";
import Tasks from "./pages/tasks";
import Annotations from "./pages/annotations";
import Logs from "./pages/logs";
import ImportPage from "./pages/import";
import ConnectorPage from "./pages/connector";
import MyTasks from "./pages/my-tasks";
import AnnotationWorkspace from "./pages/annotation-workspace";
import ReviewTasks from "./pages/review-tasks";
import ReviewDetail from "./pages/review-detail";
import Templates from "./pages/templates";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/users" component={Users} />
      <Route path="/experiments" component={Experiments} />
      <Route path="/experiments/:id" component={ExperimentDetail} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/annotations" component={Annotations} />
      <Route path="/logs" component={Logs} />
      <Route path="/import" component={ImportPage} />
      <Route path="/connector" component={ConnectorPage} />
      <Route path="/my-tasks" component={MyTasks} />
      <Route path="/annotation/:id" component={AnnotationWorkspace} />
      <Route path="/review-tasks" component={ReviewTasks} />
      <Route path="/review/:id" component={ReviewDetail} />
      <Route path="/templates" component={Templates} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
