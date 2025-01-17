/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { AppType } from "./globalTypes";

// ====================================================
// GraphQL query operation: UpdateAppGetData
// ====================================================

export interface UpdateAppGetData_getApp {
  __typename: "App";
  /**
   * ID of the `App`
   */
  id: string;
  /**
   * Name of the Application
   */
  name: string;
  /**
   * The domain name of the `App`
   */
  domain: string;
  /**
   * The `AppType` associated with this App. Please note that currently on WEB is supported. MOBILE_APP will be introduced soon!
   */
  type: AppType;
}

export interface UpdateAppGetData {
  /**
   * @bound=App
   * Get an App model from the App ID
   */
  getApp: UpdateAppGetData_getApp;
}

export interface UpdateAppGetDataVariables {
  id: string;
}
