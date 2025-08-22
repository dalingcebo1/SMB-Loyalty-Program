import React from "react";
import { ConfirmationResult } from "firebase/auth";

// Shared reference for OTP confirmation between onboarding and verify pages
export const confirmationRef = React.createRef<ConfirmationResult>();
