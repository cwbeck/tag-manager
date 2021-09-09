/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { TagType } from "./globalTypes";

// ====================================================
// GraphQL query operation: TagInstructionsData
// ====================================================

export interface TagInstructionsData_getTag {
  __typename: "Tag";
  /**
   * Tag ID
   */
  id: string;
  /**
   * Tag name
   */
  name: string;
  /**
   * Tag code, this persists when cloned. It is generated by the parent tag and inherited by all other tags cloned from this point. It is immutable by design.
   */
  tag_code: string;
  /**
   * Tag type, see `TagType`
   */
  type: TagType;
  /**
   * If the tag should be automatically loaded on all pages.
   */
  auto_load: boolean;
}

export interface TagInstructionsData {
  /**
   * @bound=Tag
   * Get an Tag model from the Tag ID
   */
  getTag: TagInstructionsData_getTag;
}

export interface TagInstructionsDataVariables {
  id: string;
}