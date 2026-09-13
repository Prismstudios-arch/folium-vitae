#!/bin/bash
cd backend
npm ci --omit=dev
npm run dev
