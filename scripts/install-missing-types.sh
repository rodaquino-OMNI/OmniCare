#!/bin/bash

# Script to install missing @types packages

echo "Installing missing @types packages for frontend..."

cd frontend

# Install missing React Router DOM types
npm install --save-dev @types/react-router-dom@^6.0.0

# Install React Error Boundary types (if not already installed)
npm install --save-dev @types/react-error-boundary

# Install additional testing types
npm install --save-dev @types/testing-library__jest-dom
npm install --save-dev @types/testing-library__user-event

echo "Installing missing @types packages for backend..."

cd ../backend

# Install Express related types that might be missing
npm install --save-dev @types/express-serve-static-core
npm install --save-dev @types/express-rate-limit
npm install --save-dev @types/express-validator

# Install additional utility types
npm install --save-dev @types/node-cron
npm install --save-dev @types/helmet
npm install --save-dev @types/morgan
npm install --save-dev @types/ws

echo "Installing shared utility types..."

cd ..

# Install any shared types needed
npm install --save-dev @types/lodash

echo "Finished installing missing @types packages"