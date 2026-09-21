import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { workflowRecipes, type WorkflowRecipe } from "@/content/workflow-recipes";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import styles from "./product.module.css";

export function RecipeIngredients({ id }: { id: string }) {
  const recipe = workflowRecipes.find((item) => item.id === id);
  if (!recipe) return null;
  return (
    <div className="not-prose my-6">
      <p className="text-sm font-semibold">What you combine</p>
      <ul className={styles.parts}>
        {recipe.components.map((part) => (
          <li key={part.href}>
            <Link href={part.href}>{part.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecipeCards({ recipes }: { recipes: WorkflowRecipe[] }) {
  return (
    <StaggerContainer className={styles.grid} staggerDelay={0.1}>
      {recipes.map((recipe) => (
        <article className={styles.card} key={recipe.id}>
          <p className="label">{recipe.industryName}</p>
          <h3>{recipe.title}</h3>
          <p>{recipe.description}</p>
          <ul className={styles.parts} aria-label="Features and plugins combined">
            {recipe.components.map((part) => (
              <li key={part.href}>{part.label}</li>
            ))}
          </ul>
          <Link className={styles.textLink} href={`/docs/recipes/${recipe.id}`}>
            Follow the recipe <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </article>
      ))}
    </StaggerContainer>
  );
}

export function RecipeIndex() {
  const industries = [...new Set(workflowRecipes.map((item) => item.industry))];
  return (
    <div className="not-prose">
      {industries.map((industry) => (
        <section key={industry} className="my-10" aria-labelledby={`recipes-${industry}`}>
          <h2 id={`recipes-${industry}`} className="mb-5 font-display text-2xl font-medium">
            {workflowRecipes.find((item) => item.industry === industry)!.industryName}
          </h2>
          <RecipeCards recipes={workflowRecipes.filter((item) => item.industry === industry)} />
        </section>
      ))}
    </div>
  );
}

export function IndustryRecipes({ industry }: { industry: string }) {
  const recipes = workflowRecipes.filter((item) => item.industry === industry);
  if (!recipes.length) return null;
  return (
    <section
      className={styles.section}
      id="workflow-recipes"
      aria-labelledby="workflow-recipes-title"
    >
      <div className="wrap">
        <AnimateOnScroll className={styles.sectionIntro} stagger>
          <div>
            <p className="label">Practical platform recipes</p>
            <h2 id="workflow-recipes-title" className={styles.heading}>
              Put the pieces to work for your business.
            </h2>
          </div>
          <p className={styles.lede}>
            When a connected workspace fits your needs, combine Command Center features and plugins
            around a specific job. These guides show the setup, the steps and the result to check.
          </p>
        </AnimateOnScroll>
        <RecipeCards recipes={recipes} />
        <AnimateOnScroll as="div" delay={0.24}>
          <Link className={styles.textLink} href="/docs/recipes">
            Browse all workflow recipes <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
