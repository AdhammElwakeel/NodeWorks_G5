import numpy as np
import matplotlib.pyplot as plt

# Generate a continuous range for 'years' from 0 to 20
years = np.linspace(0, 20, 500)

# Define the scenarios for MAX_EXPERIENCE_YEARS
max_exp_scenarios = [5, 10, 15]
# Colors selected to closely match the original plot
colors = ['#1f77b4', '#c49a2a', '#1ca085'] 

plt.figure(figsize=(10, 6), dpi=100)

# Plot each scenario
for max_exp, color in zip(max_exp_scenarios, colors):
    # Equation: min(years / MAX_EXPERIENCE_YEARS, 1) * 100
    exp_bonus = np.minimum(years / max_exp, 1.0) * 100
    plt.plot(years, exp_bonus, label=f'MAX_EXPERIENCE_YEARS = {max_exp}', color=color, linewidth=1.8)

# Title and Labels using LaTeX formatting for the equation
plt.title(r'Plot of $exp\ bonus = \min\left(\frac{years}{MAX\ EXPERIENCE\ YEARS}, 1\right) \cdot 100$', fontsize=13, pad=15)
plt.xlabel('years', fontsize=11)
plt.ylabel('exp bonus', fontsize=11)

# Set axis limits (giving 20% breathing room at the top just like the original's 1.2 mark)
plt.xlim(0.0, 20.0)
plt.ylim(0.0, 120.0)

# Match the grid formatting from your original image
plt.grid(True, linestyle='--', color='#cccccc', alpha=0.8)

# Match tick intervals
plt.xticks(np.arange(0.0, 20.1, 2.5))
plt.yticks(np.arange(0.0, 120.1, 20.0))

# Legend configuration
plt.legend(loc='upper right', frameon=True, facecolor='white', edgecolor='#e0e0e0', fontsize=10)

# Display the clean plot
plt.tight_layout()
plt.show()